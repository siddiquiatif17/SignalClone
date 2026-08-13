import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Enum as SQLEnum,
    Text,
)
from sqlalchemy.orm import relationship
from app.db import Base

# --- Enums ---

class ConversationType(str, enum.Enum):
    DIRECT = "direct"
    GROUP = "group"

class ParticipantRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"

class MessageType(str, enum.Enum):
    TEXT = "text"
    SYSTEM = "system"
    ATTACHMENT = "attachment"

class ReceiptStatus(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


# --- Models ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)  # Mock password storage
    is_online = Column(Boolean, default=False, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    # Contacts owner or added
    contacts_owned = relationship("Contact", foreign_keys="[Contact.owner_id]", back_populates="owner", cascade="all, delete-orphan")
    contacts_added_by = relationship("Contact", foreign_keys="[Contact.contact_user_id]", back_populates="contact_user", cascade="all, delete-orphan")
    
    # Conversations created by user
    created_conversations = relationship("Conversation", back_populates="creator")
    
    # Conversations this user participates in
    participations = relationship("ConversationParticipant", back_populates="user", cascade="all, delete-orphan")
    
    # Messages sent by user
    sent_messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    
    # Receipts for messages this user received
    receipts = relationship("MessageReceipt", back_populates="user", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    contact_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], back_populates="contacts_owned")
    contact_user = relationship("User", foreign_keys=[contact_user_id], back_populates="contacts_added_by")

    # Constraints
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id", name="uq_contact_owner_contact_user"),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(ConversationType), nullable=False)
    name = Column(String, nullable=True)  # Nuallable, groups only
    avatar_url = Column(String, nullable=True)  # Nullable, groups only
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", back_populates="created_conversations")
    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(SQLEnum(ParticipantRole), default=ParticipantRole.MEMBER, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_read_message_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User", back_populates="participations")
    last_read_message = relationship("Message", foreign_keys=[last_read_message_id])

    # Constraints
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_participant_user"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(SQLEnum(MessageType), default=MessageType.TEXT, nullable=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    
    # Self-referential reply relationship
    reply_to = relationship("Message", back_populates="replies", remote_side=[id], foreign_keys=[reply_to_id])
    replies = relationship("Message", back_populates="reply_to", foreign_keys=[reply_to_id])
    
    # Receipts for this message
    receipts = relationship("MessageReceipt", back_populates="message", cascade="all, delete-orphan")


class MessageReceipt(Base):
    __tablename__ = "message_receipts"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(ReceiptStatus), default=ReceiptStatus.SENT, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    message = relationship("Message", back_populates="receipts")
    user = relationship("User", back_populates="receipts")

    # Constraints
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_receipt_user"),
    )
