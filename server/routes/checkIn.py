import json
import logging

logging.basicConfig(level=logging.DEBUG)

from flask import Blueprint, request, jsonify, current_app,Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from pydantic import ValidationError
from models.check_in import CheckIn, Frequency
from dotenv import load_dotenv
from services.azure_mongodb import MongoDBClient
from bson import ObjectId,json_util
from pymongo import ReturnDocument
from bson.errors import InvalidId
from .scheduler_main import scheduler
from models.subscription import Subscription,db
from services.scheduler import send_push_notification
import logging
logging.basicConfig(level=logging.DEBUG)


load_dotenv()

db_client = MongoDBClient.get_client()
db = db_client[MongoDBClient.get_db_name()]

checkIn_routes = Blueprint("checkIn", __name__)


@checkIn_routes.post('/checkIn/schedule')
def schedule_check_in():
    try:     # Parse and validate the request data using Pydantic model
        data = request.get_json()
        check_in_time = datetime.fromisoformat(data['check_in_time'])
        check_in_date = datetime.fromisoformat(data['check_in_time']).date()

        if CheckIn.count_user_check_ins(db, data['user_id'], check_in_date) >= 5:
            return jsonify({'message': 'Limit of 5 check-ins per day exceeded'}), 403

        if not CheckIn.validate_check_in_time(db, data['user_id'], check_in_time):
            return jsonify({'error': 'Check-in time conflicts with an existing schedule'}), 409

        check_in = CheckIn(
            user_id=data['user_id'],
            check_in_time=check_in_time,
            frequency=Frequency(data['frequency']),
            notify=data.get('notify', False)
        )

        # Convert Pydantic model to dictionary for MongoDB
        check_in_dict = check_in.dict()
        # Ensure datetime is handled correctly
        check_in_dict['check_in_time'] = check_in.check_in_time

        # Insert the new check-in into MongoDB
        result = db.check_ins.insert_one(check_in_dict)
        # Start scheduling notifications right after check-in creation
        scheduler.schedule_notifications(check_in_dict)
        return jsonify({'message': 'Check-in scheduled successfully', 'check_in_id': str(result.inserted_id)}), 201

    except ValidationError as e:
        return jsonify({'error': 'Data validation error', 'details': str(e)}), 400
    except Exception as e:
        current_app.logger.error(f"An error occurred: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@checkIn_routes.patch('/checkIn/update/<check_in_id>')
def update_check_in(check_in_id):
    data = request.get_json()
    try:
        updated_data = {}
        if 'check_in_time' in data:
            new_check_in_time = datetime.fromisoformat(data['check_in_time'])
            updated_data['check_in_time'] = new_check_in_time

            if not CheckIn.validate_check_in_time(db, data['user_id'], new_check_in_time):
                return jsonify({'error': 'Check-in time conflicts with an existing schedule'}), 409

        if 'frequency' in data:
            # Use the Frequency enum to ensure the frequency is valid
            try:
                updated_data['frequency'] = Frequency(data['frequency']).value
            except ValueError:
                return jsonify({'error': 'Invalid frequency value'}), 400

        update_result = db.check_ins.find_one_and_update(
            {'_id': ObjectId(check_in_id)},
            {'$set': updated_data},
            return_document=ReturnDocument.AFTER
        )
        if update_result:
            # clear any previous notifications before creating new ones based on new check-in data.
            scheduler.clear_check_in_notifications(check_in_id, update_result['user_id'])
            scheduler.schedule_notifications(update_result)
            return jsonify({'message': 'Check-in updated successfully'}), 200
        else:
            return jsonify({'message': 'No check-in found with provided ID or no update needed'}), 404

    except ValidationError as e:
        return jsonify({'error': 'Data validation error', 'details': str(e)}), 400
    except InvalidId:
        return jsonify({'error': 'Invalid check-in ID'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@checkIn_routes.get('/checkIn/retrieve/<check_in_id>')
def retrieve_check_in(check_in_id):
    logging.debug(f"Attempting to retrieve check-in with ID: {check_in_id}")
    try:
        check_in = db.check_ins.find_one({'_id': ObjectId(check_in_id)})
        logging.debug(f"Database response: {check_in}")
        if check_in:
           return Response(
                json_util.dumps(check_in),
                mimetype='application/json'
            )
        else:
            return jsonify({'message': 'Check-in not found'}), 404
    except InvalidId:
        logging.error("Invalid check-in ID provided.")
        return jsonify({'error': 'Invalid check-in ID format'}), 400
    except Exception as e:
        logging.error(f"An unexpected error occurred: {str(e)}")
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500

@checkIn_routes.delete('/checkIn/delete/<check_in_id>')
def delete_check_in(check_in_id):
    try:
        result = db.check_ins.delete_one({'_id': ObjectId(check_in_id)})
        if result.deleted_count:
            return jsonify({'message': 'Check-in deleted successfully'}), 200
        else:
            return jsonify({'message': 'Check-in not found'}), 404
    except InvalidId:
        return jsonify({'error': 'Invalid check-in ID format'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@checkIn_routes.get('/checkIn/retrieveAll')
def retrieve_all_check_ins():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    try:
        check_ins = db.check_ins.find({'user_id': user_id})
        check_ins_list = list(check_ins)  # Convert the cursor to a list
        if check_ins_list:
            return Response(json_util.dumps(check_ins_list), mimetype='application/json'), 200
        else:
            return jsonify({'message': 'No check-ins found for the user'}), 404
    except Exception as e:
        current_app.logger.error(f'Error retrieving check-ins: {str(e)}')
        return jsonify({'error': str(e)}), 500


@checkIn_routes.get('/checkIn/missed')
def check_missed_check_ins():
    user_id = request.args.get('user_id')
    now = datetime.now() - timedelta(minutes=10)
    missed_check_ins = db.check_ins.find({
        'user_name': user_id,
        'check_in_time': {'$lt': now},
        'status': 'upcoming'  # Assuming 'upcoming' means not yet checked in
    })

    missed = list(missed_check_ins)  # Convert cursor to a list 
    if len(missed) > 0:  # Check length of list to get count
        db.check_ins.update_many(
            {'user_id': user_id, 'check_in_time': {
                '$lt': now}, 'status': 'upcoming'},
            {'$set': {'status': 'missed'}}
        )
        return jsonify({'message': 'You have missed check-ins, would you like to complete them now?', 'missed': list(missed_check_ins)}), 200
    else:
        return jsonify({'message': 'No missed check-ins'}), 200


@checkIn_routes.route('/subscribe', methods=['POST'])
@jwt_required()
def subscribe():
    data = request.json
    print(f"Received subscription data: {data}")
    
    if not data or 'endpoint' not in data or 'keys' not in data or 'p256dh' not in data['keys'] or 'auth' not in data['keys']:
        return jsonify({'error': 'Missing required fields'}), 400
    
    
    subscription_info = json.dumps({
        'endpoint': data['endpoint'],
        'keys': {
            'p256dh': data['keys']['p256dh'],
            'auth': data['keys']['auth']
        }
    })

    user_id = get_jwt_identity()

    # Check if the subscription already exists
    existing_subscription = Subscription.query.filter_by(user_id=user_id).first()
    if existing_subscription:
         # Update existing subscription
        existing_subscription.subscription_info = subscription_info
    else:
        # Create new subscription
        new_subscription = Subscription(user_id=user_id, subscription_info=subscription_info)
        db.session.add(new_subscription)
    
    db.session.commit()

    return jsonify({'message': 'Subscription saved successfully'}), 200

@checkIn_routes.route('/send_push', methods=['POST'])
@jwt_required()
def send_push():
    data = request.json
    user_id = data['user_id']
    message = data['message']
    success = send_push_notification(user_id, message)
    if success:
        return jsonify({'message': 'Push notification sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send push notification'}), 500