from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db import get_db
from app.models.models import Message, ConversationParticipant
from app.schemas.schemas import MessageCreateRequest, MessageRead
from app.core.security import get_current_user
from app.services.messages import create_and_broadcast_message

router = APIRouter(prefix="/conversations/{id}/messages", tags=["Messages"])

@router.get("", response_model=List[MessageRead])
def get_message_history(
    id: int,
    before: Optional[int] = None,
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the message history of a conversation.
    Supports pagination via the 'before' query parameter (fetches messages with ID < before).
    Returned in chronological order (oldest first).
    """
    # 1. Verify user is participant
    is_participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )
        
    # 2. Query messages
    query = db.query(Message).filter(Message.conversation_id == id)
    
    if before is not None:
        query = query.filter(Message.id < before)
        
    # Fetch newest first internally for pagination, limited
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    
    # Reverse to return chronological order
    messages.reverse()
    return messages

@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def send_message(
    id: int,
    request: MessageCreateRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a message within a conversation.
    Creates the database record, updates conversation timestamps, and pushes
    real-time event transmissions via WebSockets to participants.
    """
    # 1. Verify user is participant
    is_participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )
        
    # 2. Persist message and broadcast through WebSockets
    try:
        new_msg = await create_and_broadcast_message(
            db=db,
            conversation_id=id,
            sender_id=current_user.id,
            content=request.content,
            reply_to_id=request.reply_to_id
        )
        return new_msg
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post and broadcast message: {str(e)}"
        )
