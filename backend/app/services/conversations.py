from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.models.models import (
    Conversation,
    ConversationParticipant,
    Message,
    ConversationType,
    User,
)

def get_unread_count(db: Session, conversation_id: int, last_read_id: Optional[int]) -> int:
    """
    Computes the unread message count in a conversation by counting messages
    created after the user's last_read_message_id.
    """
    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if last_read_id is not None:
        query = query.filter(Message.id > last_read_id)
    return query.count()

def get_last_message(db: Session, conversation_id: int) -> Optional[Message]:
    """
    Fetches the most recently created message in a conversation.
    """
    return db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.desc()).first()

def format_conversation_details(db: Session, conversation: Conversation, current_user_id: int) -> Dict[str, Any]:
    """
    Resolves naming and avatar URLs for direct chats, computes the unread count,
    retrieves the last message, and maps the sort_timestamp.
    """
    # Find current user's participant metadata (like last_read_message_id)
    current_participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation.id,
        ConversationParticipant.user_id == current_user_id
    ).first()
    
    last_read_id = current_participant.last_read_message_id if current_participant else None

    # Resolve name and avatar
    resolved_name = conversation.name
    resolved_avatar = conversation.avatar_url

    if conversation.type == ConversationType.DIRECT:
        # Find the other participant in the direct chat
        other_participant = db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == conversation.id,
            ConversationParticipant.user_id != current_user_id
        ).first()
        
        if other_participant and other_participant.user:
            resolved_name = other_participant.user.display_name
            resolved_avatar = other_participant.user.avatar_url
        else:
            resolved_name = "Deleted User"
            resolved_avatar = None

    last_message = get_last_message(db, conversation.id)
    unread_count = get_unread_count(db, conversation.id, last_read_id)

    # Sort timestamp defaults to last message created_at, fallback to conversation updated_at
    sort_timestamp = last_message.created_at if last_message else conversation.updated_at

    return {
        "id": conversation.id,
        "type": conversation.type.value,
        "name": resolved_name,
        "avatar_url": resolved_avatar,
        "created_by": conversation.created_by,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "sort_timestamp": sort_timestamp,
        "unread_count": unread_count,
        "last_message": last_message,
        "participants": conversation.participants,
    }
