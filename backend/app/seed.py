import sys
from datetime import datetime, timedelta
from app.db import engine, SessionLocal
from app.models import (
    Base,
    User,
    Contact,
    Conversation,
    ConversationParticipant,
    Message,
    MessageReceipt,
    ConversationType,
    ParticipantRole,
    MessageType,
    ReceiptStatus,
)

def seed_db():
    print("Connecting to database and wiping tables...")
    # Drop and recreate tables to ensure clean seeding
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Creating users...")
        users_data = [
            {"username": "alice", "display_name": "Alice Smith", "phone_number": "+1234567890"},
            {"username": "bob", "display_name": "Bob Johnson", "phone_number": "+1234567891"},
            {"username": "charlie", "display_name": "Charlie Brown", "phone_number": "+1234567892"},
            {"username": "diana", "display_name": "Diana Prince", "phone_number": "+1234567893"},
            {"username": "ethan", "display_name": "Ethan Hunt", "phone_number": "+1234567894"},
        ]
        
        users = []
        for u in users_data:
            user = User(
                username=u["username"],
                display_name=u["display_name"],
                phone_number=u["phone_number"],
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={u['username']}",
                password_hash="pbkdf2:sha256:mock_hash_for_123456",  # Mock password hash
                is_online=(u["username"] in ["alice", "bob"]),
                last_seen=datetime.utcnow() if u["username"] in ["alice", "bob"] else datetime.utcnow() - timedelta(minutes=45),
            )
            db.add(user)
            users.append(user)
        
        db.commit()
        # Refresh to get IDs
        for u in users:
            db.refresh(u)

        user_map = {u.username: u for u in users}
        print(f"Created {len(users)} users.")

        print("Creating contacts...")
        # Add contacts (owner -> contact_user)
        # Alice knows Bob, Charlie, Diana
        # Bob knows Alice, Charlie, Ethan
        # Charlie knows Alice, Bob, Diana, Ethan
        # Diana knows Alice, Charlie, Ethan
        # Ethan knows Bob, Charlie, Diana
        contacts_relations = [
            ("alice", "bob"), ("alice", "charlie"), ("alice", "diana"),
            ("bob", "alice"), ("bob", "charlie"), ("bob", "ethan"),
            ("charlie", "alice"), ("charlie", "bob"), ("charlie", "diana"), ("charlie", "ethan"),
            ("diana", "alice"), ("diana", "charlie"), ("diana", "ethan"),
            ("ethan", "bob"), ("ethan", "charlie"), ("ethan", "diana"),
        ]

        contact_count = 0
        for owner_un, contact_un in contacts_relations:
            contact = Contact(
                owner_id=user_map[owner_un].id,
                contact_user_id=user_map[contact_un].id
            )
            db.add(contact)
            contact_count += 1
        
        db.commit()
        print(f"Created {contact_count} contacts.")

        print("Creating conversations...")
        # 1. Direct Alice & Bob
        conv_alice_bob = Conversation(
            type=ConversationType.DIRECT,
            created_by=user_map["alice"].id,
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(conv_alice_bob)

        # 2. Direct Alice & Charlie
        conv_alice_charlie = Conversation(
            type=ConversationType.DIRECT,
            created_by=user_map["alice"].id,
            created_at=datetime.utcnow() - timedelta(days=4)
        )
        db.add(conv_alice_charlie)

        # 3. Direct Bob & Charlie
        conv_bob_charlie = Conversation(
            type=ConversationType.DIRECT,
            created_by=user_map["bob"].id,
            created_at=datetime.utcnow() - timedelta(days=3)
        )
        db.add(conv_bob_charlie)

        # 4. Group Development Team (Alice, Bob, Charlie, Diana)
        conv_group = Conversation(
            type=ConversationType.GROUP,
            name="Development Team",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=devteam",
            created_by=user_map["alice"].id,
            created_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(conv_group)

        db.commit()
        db.refresh(conv_alice_bob)
        db.refresh(conv_alice_charlie)
        db.refresh(conv_bob_charlie)
        db.refresh(conv_group)
        print("Created conversations.")

        print("Adding participants...")
        participants = []
        
        # Helper to add participant
        def add_participant(conversation_id, user_id, role=ParticipantRole.MEMBER, joined_offset_days=0):
            part = ConversationParticipant(
                conversation_id=conversation_id,
                user_id=user_id,
                role=role,
                joined_at=datetime.utcnow() - timedelta(days=joined_offset_days)
            )
            db.add(part)
            participants.append(part)
            return part

        # Participants for Direct 1: Alice & Bob
        p_ab_a = add_participant(conv_alice_bob.id, user_map["alice"].id, joined_offset_days=5)
        p_ab_b = add_participant(conv_alice_bob.id, user_map["bob"].id, joined_offset_days=5)

        # Participants for Direct 2: Alice & Charlie
        p_ac_a = add_participant(conv_alice_charlie.id, user_map["alice"].id, joined_offset_days=4)
        p_ac_c = add_participant(conv_alice_charlie.id, user_map["charlie"].id, joined_offset_days=4)

        # Participants for Direct 3: Bob & Charlie
        p_bc_b = add_participant(conv_bob_charlie.id, user_map["bob"].id, joined_offset_days=3)
        p_bc_c = add_participant(conv_bob_charlie.id, user_map["charlie"].id, joined_offset_days=3)

        # Participants for Group: Alice (Admin), Bob, Charlie, Diana
        p_g_a = add_participant(conv_group.id, user_map["alice"].id, role=ParticipantRole.ADMIN, joined_offset_days=2)
        p_g_b = add_participant(conv_group.id, user_map["bob"].id, joined_offset_days=2)
        p_g_c = add_participant(conv_group.id, user_map["charlie"].id, joined_offset_days=2)
        p_g_d = add_participant(conv_group.id, user_map["diana"].id, joined_offset_days=2)

        db.commit()
        print(f"Added {len(participants)} participants to conversations.")

        print("Generating messages...")
        messages = []
        now = datetime.utcnow()

        # Helper to define messages
        # Structure: (conversation_id, sender_username, content, offset_delta, message_type)
        message_specs = [
            # --- Alice & Bob (Direct 1) ---
            (conv_alice_bob.id, "alice", "Hey Bob! Did you check out the new backend specs?", now - timedelta(days=4, hours=6), MessageType.TEXT),
            (conv_alice_bob.id, "bob", "Hey Alice, yes, I just read them. Looks clean!", now - timedelta(days=4, hours=5, minutes=45), MessageType.TEXT),
            (conv_alice_bob.id, "alice", "Awesome. I'm setting up the schema now.", now - timedelta(days=4, hours=5, minutes=30), MessageType.TEXT),
            (conv_alice_bob.id, "bob", "Sounds great. Let me know if you need help with the seed script.", now - timedelta(days=3, hours=12), MessageType.TEXT),
            (conv_alice_bob.id, "alice", "Here is the layout file I drafted.", now - timedelta(days=2, hours=4), MessageType.ATTACHMENT),
            (conv_alice_bob.id, "bob", "Nice! It compiles cleanly on my end.", now - timedelta(days=2, hours=3, minutes=50), MessageType.TEXT),
            (conv_alice_bob.id, "alice", "Awesome, let's keep going.", now - timedelta(hours=18), MessageType.TEXT),
            (conv_alice_bob.id, "bob", "Perfect! I will write the router logic later.", now - timedelta(minutes=15), MessageType.TEXT),

            # --- Alice & Charlie (Direct 2) ---
            (conv_alice_charlie.id, "alice", "Hi Charlie, welcome to our Signal clone project workspace!", now - timedelta(days=3, hours=10), MessageType.TEXT),
            (conv_alice_charlie.id, "charlie", "Thanks Alice! Excited to collaborate.", now - timedelta(days=3, hours=9, minutes=30), MessageType.TEXT),
            (conv_alice_charlie.id, "alice", "Can you help set up the initial Tailwind styling?", now - timedelta(days=2, hours=15), MessageType.TEXT),
            (conv_alice_charlie.id, "charlie", "Sure, I will configure globals.css with Signal navy custom palettes.", now - timedelta(days=2, hours=14, minutes=40), MessageType.TEXT),
            (conv_alice_charlie.id, "charlie", "Here is the style mockup.", now - timedelta(days=1, hours=8), MessageType.ATTACHMENT),
            (conv_alice_charlie.id, "alice", "Oh this looks spectacular!", now - timedelta(hours=6), MessageType.TEXT),
            (conv_alice_charlie.id, "charlie", "Glad you like it! Let me know when the backend is ready.", now - timedelta(hours=5, minutes=45), MessageType.TEXT),

            # --- Bob & Charlie (Direct 3) ---
            (conv_bob_charlie.id, "bob", "Hey Charlie, are we meeting up today?", now - timedelta(days=2, hours=8), MessageType.TEXT),
            (conv_bob_charlie.id, "charlie", "Yes, in about 30 minutes in the main room.", now - timedelta(days=2, hours=7, minutes=50), MessageType.TEXT),
            (conv_bob_charlie.id, "bob", "Got it. I will bring my laptop.", now - timedelta(days=2, hours=7, minutes=45), MessageType.TEXT),
            (conv_bob_charlie.id, "charlie", "Let's review the websocket connection manager.", now - timedelta(hours=4), MessageType.TEXT),
            (conv_bob_charlie.id, "bob", "Sure, I have some questions about connection broadcasting.", now - timedelta(hours=3, minutes=55), MessageType.TEXT),
            (conv_bob_charlie.id, "charlie", "No worries, we will sketch it out.", now - timedelta(hours=3, minutes=30), MessageType.TEXT),

            # --- Group Conversation: Development Team ---
            (conv_group.id, "alice", "Alice Smith created the group 'Development Team'", now - timedelta(days=1, hours=23), MessageType.SYSTEM),
            (conv_group.id, "alice", "Alice Smith added Bob Johnson, Charlie Brown, and Diana Prince", now - timedelta(days=1, hours=22, minutes=55), MessageType.SYSTEM),
            (conv_group.id, "alice", "Hello everyone! This is the official project group chat.", now - timedelta(days=1, hours=22, minutes=50), MessageType.TEXT),
            (conv_group.id, "bob", "Hello! Reporting for duty.", now - timedelta(days=1, hours=22, minutes=30), MessageType.TEXT),
            (conv_group.id, "charlie", "Hey team! Ready to build.", now - timedelta(days=1, hours=22, minutes=20), MessageType.TEXT),
            (conv_group.id, "diana", "Hi all, great to be here.", now - timedelta(days=1, hours=21), MessageType.TEXT),
            (conv_group.id, "alice", "Let's align on roles. Bob is working on WS, Charlie on styling, and Diana on DB optimization.", now - timedelta(days=1, hours=10), MessageType.TEXT),
            (conv_group.id, "diana", "Sounds perfect. I'll prepare some indexing schemas.", now - timedelta(days=1, hours=9, minutes=45), MessageType.TEXT),
            (conv_group.id, "bob", "I will start mapping the WebSocket events logic today.", now - timedelta(hours=12), MessageType.TEXT),
            (conv_group.id, "charlie", "Here is a sketch of the mobile layout breakpoints.", now - timedelta(hours=10), MessageType.ATTACHMENT),
            (conv_group.id, "alice", "Great job Charlie! Diana, can you check if the indexes fit our queries?", now - timedelta(hours=8), MessageType.TEXT),
            (conv_group.id, "diana", "Yes, I will review the explain plans for messages table.", now - timedelta(hours=7, minutes=30), MessageType.TEXT),
            (conv_group.id, "alice", "How is the WebSocket event handler progress, Bob?", now - timedelta(hours=2), MessageType.TEXT),
            (conv_group.id, "bob", "Almost done. Just debugging the typing indicator broadcasts.", now - timedelta(hours=1), MessageType.TEXT),
            (conv_group.id, "charlie", "Awesome. Once that is in, we can wire up the UI typing bubble.", now - timedelta(minutes=45), MessageType.TEXT),
            (conv_group.id, "alice", "Perfect. Let's aim to demo tomorrow.", now - timedelta(minutes=30), MessageType.TEXT),
            (conv_group.id, "diana", "Will do, my indexes are ready.", now - timedelta(minutes=15), MessageType.TEXT),
            (conv_group.id, "bob", "Finished with typing indicator! Ready for testing.", now - timedelta(minutes=5), MessageType.TEXT),
        ]

        # Insert messages and maintain list reference
        for idx, (cid, sender_un, content, created_at, m_type) in enumerate(message_specs):
            msg = Message(
                conversation_id=cid,
                sender_id=user_map[sender_un].id,
                content=content,
                message_type=m_type,
                created_at=created_at,
                updated_at=created_at,
                is_deleted=False
            )
            # Add some replies for variety
            if idx == 1:  # Bob's reply to Alice's first message
                msg.reply_to_id = 1
            elif idx == 28:  # Diana's reply to Alice in group
                msg.reply_to_id = 24

            db.add(msg)
            messages.append(msg)

        db.commit()
        # Refresh messages to obtain IDs
        for m in messages:
            db.refresh(m)
        
        print(f"Generated {len(messages)} messages.")

        print("Generating receipts and setting participants read pointers...")
        # Map conversation participants
        # Direct convs:
        # conv_alice_bob: Alice, Bob
        # conv_alice_charlie: Alice, Charlie
        # conv_bob_charlie: Bob, Charlie
        # conv_group: Alice, Bob, Charlie, Diana
        
        receipt_count = 0
        for msg in messages:
            # Find participants in this conversation
            participants_in_conv = db.query(ConversationParticipant).filter(
                ConversationParticipant.conversation_id == msg.conversation_id
            ).all()

            for p in participants_in_conv:
                # Exclude the sender
                if p.user_id == msg.sender_id:
                    continue
                
                # Stagger status based on age of the message
                age_minutes = (now - msg.created_at).total_seconds() / 60
                
                if age_minutes > 120:  # Older than 2 hours is READ
                    status = ReceiptStatus.READ
                elif age_minutes > 15:  # Older than 15 mins is DELIVERED
                    status = ReceiptStatus.DELIVERED
                else:  # Under 15 mins is SENT
                    status = ReceiptStatus.SENT

                receipt = MessageReceipt(
                    message_id=msg.id,
                    user_id=p.user_id,
                    status=status,
                    updated_at=msg.created_at + timedelta(minutes=5) if status != ReceiptStatus.SENT else msg.created_at
                )
                db.add(receipt)
                receipt_count += 1

        db.commit()
        print(f"Created {receipt_count} message receipts.")

        # Update last_read_message_id for participants based on what is READ
        # Find the latest message in each conversation that a user has read or sent
        for p in participants:
            # Get messages in this conversation ordered by created_at desc
            conv_messages = db.query(Message).filter(
                Message.conversation_id == p.conversation_id
            ).order_by(Message.created_at.desc()).all()

            # Find the latest message that the participant has read (or sent themselves)
            latest_read_msg = None
            for msg in conv_messages:
                if msg.sender_id == p.user_id:
                    latest_read_msg = msg
                    break
                else:
                    # Check if there is a READ receipt for this user/message
                    receipt = db.query(MessageReceipt).filter(
                        MessageReceipt.message_id == msg.id,
                        MessageReceipt.user_id == p.user_id,
                        MessageReceipt.status == ReceiptStatus.READ
                    ).first()
                    if receipt:
                        latest_read_msg = msg
                        break

            if latest_read_msg:
                p.last_read_message_id = latest_read_msg.id
                db.add(p)

        db.commit()
        print("Updated conversation participant read markers.")

        print("\n--- Seeding Summary ---")
        print(f"Users: {db.query(User).count()}")
        print(f"Contacts: {db.query(Contact).count()}")
        print(f"Conversations: {db.query(Conversation).count()}")
        print(f"Participants: {db.query(ConversationParticipant).count()}")
        print(f"Messages: {db.query(Message).count()}")
        print(f"Receipts: {db.query(MessageReceipt).count()}")
        print("-----------------------")
        print("Database seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
