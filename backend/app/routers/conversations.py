from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.services.receipts import mark_conversation_as_read

from app.db import get_db
from app.models.models import (
    Conversation,
    ConversationParticipant,
    ConversationType,
    ParticipantRole,
    User,
)
from app.schemas.schemas import (
    ConversationCreateDirect,
    ConversationResponseRead,
)
from app.core.security import get_current_user
from app.services.conversations import format_conversation_details

router = APIRouter(tags=["Conversations"])

@router.get("", response_model=List[ConversationResponseRead])
def get_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retrieves all conversations the current authenticated user participates in.
    Sorted by the most recent activity (latest message or creation time).
    """
    # Find all conversation participations for the current user
    participations = db.query(ConversationParticipant).filter(
        ConversationParticipant.user_id == current_user.id
    ).all()
    
    conversations = [p.conversation for p in participations if p.conversation]
    
    # Format details (names, avatars, unread counts, last messages)
    formatted_list = []
    for conv in conversations:
        formatted = format_conversation_details(db, conv, current_user.id)
        formatted_list.append(formatted)
        
    # Sort by sort_timestamp descending
    formatted_list.sort(key=lambda x: x["sort_timestamp"], reverse=True)
    return formatted_list

@router.post("", response_model=ConversationResponseRead, status_code=status.HTTP_201_CREATED)
def create_direct_conversation(
    request: ConversationCreateDirect,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a direct 1:1 conversation. If a direct chat between the two
    users already exists, return the existing one.
    """
    if current_user.id == request.contact_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a direct conversation with yourself"
        )
        
    # Verify contact user exists
    contact_user = db.query(User).filter(User.id == request.contact_user_id).first()
    if not contact_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact user not found"
        )
        
    # Query for existing direct conversations where both users are participants
    # First find all direct conversations where current user is participating
    user_direct_participations = db.query(ConversationParticipant).join(Conversation).filter(
        Conversation.type == ConversationType.DIRECT,
        ConversationParticipant.user_id == current_user.id
    ).all()
    
    existing_conversation = None
    for part in user_direct_participations:
        # Check if the other user also participates in this specific conversation
        other_part = db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == part.conversation_id,
            ConversationParticipant.user_id == request.contact_user_id
        ).first()
        if other_part:
            existing_conversation = part.conversation
            break
            
    if existing_conversation:
        # Prevent duplicates, return existing direct conversation
        return format_conversation_details(db, existing_conversation, current_user.id)
        
    # Otherwise, create a new direct conversation
    new_conv = Conversation(
        type=ConversationType.DIRECT,
        created_by=current_user.id
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    # Add participants
    p1 = ConversationParticipant(
        conversation_id=new_conv.id,
        user_id=current_user.id,
        role=ParticipantRole.MEMBER
    )
    p2 = ConversationParticipant(
        conversation_id=new_conv.id,
        user_id=request.contact_user_id,
        role=ParticipantRole.MEMBER
    )
    db.add(p1)
    db.add(p2)
    db.commit()
    db.refresh(new_conv)
    
    return format_conversation_details(db, new_conv, current_user.id)

@router.get("/{id}", response_model=ConversationResponseRead)
def get_conversation_by_id(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches the details of a specific conversation.
    Raises 403 if the user is not a participant.
    """
    conversation = db.query(Conversation).filter(Conversation.id == id).first()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
        
    # Validate participant authorization
    is_participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )
        
    return format_conversation_details(db, conversation, current_user.id)


class MarkReadRequest(BaseModel):
    message_id: int


@router.post("/{id}/read", status_code=status.HTTP_200_OK)
async def mark_read(
    id: int,
    request: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks all receipts for messages in a conversation up to message_id as 'read'
    for the requesting user.
    """
    # Verify participant access
    is_participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )
        
    await mark_conversation_as_read(
        db=db,
        conversation_id=id,
        user_id=current_user.id,
        message_id=request.message_id
    )
    return {"status": "success"}
