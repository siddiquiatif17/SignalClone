import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import (
    Message,
    MessageReceipt,
    ConversationParticipant,
    ReceiptStatus,
)
from app.ws.manager import manager

logger = logging.getLogger("uvicorn.error")

async def mark_conversation_as_read(db: Session, conversation_id: int, user_id: int, message_id: int):
    """
    Marks all message receipts in a conversation up to and including a specified
    message_id as 'read' for the given user. Updates their last_read_message_id
    cursor and broadcasts 'receipt_update' events to original message senders.
    """
    # 1. Update participant last_read_message_id cursor
    participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id
    ).first()
    
    if participant:
        if not participant.last_read_message_id or message_id > participant.last_read_message_id:
            participant.last_read_message_id = message_id
            
    # 2. Query and update all unread receipts for this user up to message_id
    receipts = db.query(MessageReceipt).join(Message).filter(
        Message.conversation_id == conversation_id,
        MessageReceipt.user_id == user_id,
        MessageReceipt.status != ReceiptStatus.READ,
        Message.id <= message_id
    ).all()
    
    if not receipts:
        # Commit cursor update and return early if no receipts need changing
        db.commit()
        return
        
    for receipt in receipts:
        receipt.status = ReceiptStatus.READ
        receipt.updated_at = datetime.utcnow()
        
    db.commit()
    
    # 3. Dispatch read receipt notifications to the message senders
    logger.info(f"User {user_id} read {len(receipts)} messages in conversation {conversation_id}. Dispatched notifications.")
    for receipt in receipts:
        sender_id = receipt.message.sender_id
        # We notify the sender of the receipt status change
        payload = {
            "type": "receipt_update",
            "message_id": receipt.message_id,
            "user_id": user_id, # the recipient who read the message
            "status": "read"
        }
        await manager.send_to_user(sender_id, payload)
