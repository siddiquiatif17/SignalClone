from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db import get_db
from app.models.models import (
    Conversation,
    ConversationParticipant,
    ConversationType,
    ParticipantRole,
    User,
    MessageType,
)
from app.schemas.schemas import (
    GroupCreateRequest,
    ConversationResponseRead,
    ConversationParticipantRead,
    AddMemberRequest,
)
from app.core.security import get_current_user
from app.services.conversations import format_conversation_details
from app.services.messages import create_and_broadcast_message

router = APIRouter(tags=["Groups"])

@router.post("", response_model=ConversationResponseRead, status_code=status.HTTP_201_CREATED)
def create_group(
    request: GroupCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a group conversation. Creates participant rows for the creator
    (role='admin') and each member_id (role='member').
    """
    group_name = request.name.strip()
    if not group_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name cannot be empty"
        )
        
    # 1. Create group Conversation row
    new_conv = Conversation(
        type=ConversationType.GROUP,
        name=group_name,
        created_by=current_user.id
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    # 2. Validate and deduplicate member IDs
    valid_member_ids = set()
    for uid in request.member_ids:
        if uid == current_user.id:
            continue
        # Verify user exists in DB
        user_exists = db.query(User).filter(User.id == uid).first()
        if user_exists:
            valid_member_ids.add(uid)
            
    # 3. Create Admin participant (creator)
    admin_participant = ConversationParticipant(
        conversation_id=new_conv.id,
        user_id=current_user.id,
        role=ParticipantRole.ADMIN
    )
    db.add(admin_participant)
    
    # 4. Create Member participants
    for uid in valid_member_ids:
        member_participant = ConversationParticipant(
            conversation_id=new_conv.id,
            user_id=uid,
            role=ParticipantRole.MEMBER
        )
        db.add(member_participant)
        
    db.commit()
    db.refresh(new_conv)
    
    return format_conversation_details(db, new_conv, current_user.id)

@router.get("/{id}/members", response_model=List[ConversationParticipantRead])
def get_group_members(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all members (participants) of a group conversation with role details.
    Rejects the request if the current user is not a participant.
    """
    conversation = db.query(Conversation).filter(Conversation.id == id).first()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group conversation not found"
        )
        
    if conversation.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation is not a group"
        )
        
    # Check if the requesting user is a participant of this group
    requester_participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not requester_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this group's members"
        )
        
    participants = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id
    ).all()
    
    return participants


@router.post("/{id}/members", response_model=ConversationParticipantRead)
async def add_group_member(
    id: int,
    request: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a new member to the group conversation. Requester must be an admin.
    Writes a system notification message and broadcasts it.
    """
    # 1. Verify group exists and requester is admin
    requester_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not requester_part or requester_part.role != ParticipantRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can add members"
        )
        
    # 2. Check if user exists
    new_member = db.query(User).filter(User.id == request.user_id).first()
    if not new_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
        
    # 3. Check if user is already a member
    existing_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == request.user_id
    ).first()
    
    if existing_part:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this group"
        )
        
    # 4. Insert participant record
    new_part = ConversationParticipant(
        conversation_id=id,
        user_id=request.user_id,
        role=ParticipantRole.MEMBER
    )
    db.add(new_part)
    db.commit()
    db.refresh(new_part)
    
    # 5. Broadcast system message ("X added Y")
    system_content = f"{current_user.display_name} added {new_member.display_name}"
    await create_and_broadcast_message(
        db=db,
        conversation_id=id,
        sender_id=current_user.id,
        content=system_content,
        message_type=MessageType.SYSTEM
    )
    
    db.refresh(new_part)
    return new_part


@router.delete("/{id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_group_member(
    id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Removes a member from the group. Requester must be an admin.
    An admin cannot remove another admin. Writes and broadcasts a system message.
    """
    # 1. Verify group exists and requester is admin
    requester_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == current_user.id
    ).first()
    
    if not requester_part or requester_part.role != ParticipantRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can remove members"
        )
        
    # 2. Verify target participant exists
    target_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == id,
        ConversationParticipant.user_id == user_id
    ).first()
    
    if not target_part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target member not found in this group"
        )
        
    # 3. Admins cannot remove other admins
    if target_part.role == ParticipantRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot remove another admin from the group"
        )
        
    target_name = target_part.user.display_name if target_part.user else "Unknown User"
    
    # 4. Delete participant
    db.delete(target_part)
    db.commit()
    
    # 5. Broadcast system message ("X removed Y")
    system_content = f"{current_user.display_name} removed {target_name}"
    await create_and_broadcast_message(
        db=db,
        conversation_id=id,
        sender_id=current_user.id,
        content=system_content,
        message_type=MessageType.SYSTEM
    )
    
    return {"status": "success"}
