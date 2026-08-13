from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.models import ConversationType, ParticipantRole, MessageType, ReceiptStatus

# --- USER SCHEMAS ---

class UserBase(BaseModel):
    phone_number: Optional[str] = None
    username: str
    display_name: str
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None  # Mock password field

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

class RegisterRequest(BaseModel):
    phone_or_username: str
    display_name: str

class VerifyOtpRequest(BaseModel):
    phone_or_username: str
    otp: str

class LoginRequest(BaseModel):
    phone_or_username: str

class TokenResponse(BaseModel):
    token: str
    user: "UserRead"

class UserRead(UserBase):
    id: int
    is_online: bool
    last_seen: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# --- CONTACT SCHEMAS ---

class ContactBase(BaseModel):
    contact_user_id: int

class ContactCreate(BaseModel):
    contact_identifier: str  # Can be username or phone number per PRD

class ContactRead(BaseModel):
    id: int
    owner_id: int
    contact_user_id: int
    created_at: datetime
    contact_user: Optional[UserRead] = None

    class Config:
        from_attributes = True


# --- CONVERSATION SCHEMAS ---

class ConversationBase(BaseModel):
    type: ConversationType
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class ConversationCreate(BaseModel):
    type: ConversationType = ConversationType.DIRECT
    name: Optional[str] = None  # group name
    avatar_url: Optional[str] = None
    participant_ids: List[int]  # For direct: single user; for group: list of users

class ConversationRead(ConversationBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- PARTICIPANT SCHEMAS ---

class ConversationParticipantBase(BaseModel):
    conversation_id: int
    user_id: int
    role: ParticipantRole = ParticipantRole.MEMBER

class ConversationParticipantCreate(ConversationParticipantBase):
    pass

class ConversationParticipantRead(ConversationParticipantBase):
    id: int
    joined_at: datetime
    last_read_message_id: Optional[int] = None
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


# --- RECEIPT SCHEMAS ---

class MessageReceiptBase(BaseModel):
    message_id: int
    user_id: int
    status: ReceiptStatus

class MessageReceiptCreate(MessageReceiptBase):
    pass

class MessageReceiptRead(MessageReceiptBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True


# --- MESSAGE SCHEMAS ---

class MessageBase(BaseModel):
    conversation_id: int
    content: str
    message_type: MessageType = MessageType.TEXT
    reply_to_id: Optional[int] = None

class MessageCreate(MessageBase):
    pass

class MessageRead(MessageBase):
    id: int
    sender_id: int
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    receipts: List[MessageReceiptRead] = []
    sender: Optional[UserRead] = None

    class Config:
        from_attributes = True


# --- COMPOSITE READS FOR COMPLEX API ENDPOINTS ---

class ConversationWithDetailsRead(ConversationRead):
    unread_count: int = 0
    last_message: Optional[MessageRead] = None
    participants: List[ConversationParticipantRead] = []

    class Config:
        from_attributes = True


# --- CONVERSATION RESPONSE SCHEMAS (STEP 6) ---

class ConversationCreateDirect(BaseModel):
    contact_user_id: int

class ConversationResponseRead(BaseModel):
    id: int
    type: ConversationType
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    sort_timestamp: datetime
    unread_count: int
    last_message: Optional[MessageRead] = None
    participants: List[ConversationParticipantRead] = []

    class Config:
        from_attributes = True


# --- MESSAGE REQUEST SCHEMAS (STEP 9) ---

class MessageCreateRequest(BaseModel):
    content: str
    reply_to_id: Optional[int] = None


# --- GROUP RESPONSE SCHEMAS (STEP 10) ---

class GroupCreateRequest(BaseModel):
    name: str
    member_ids: List[int]


class AddMemberRequest(BaseModel):
    user_id: int
