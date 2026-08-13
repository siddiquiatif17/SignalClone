from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db import get_db
from app.models.models import Contact, User
from app.schemas.schemas import ContactCreate, ContactRead
from app.core.security import get_current_user

router = APIRouter(tags=["Contacts"])

@router.get("", response_model=List[ContactRead])
def get_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Lists all contacts belonging to the authenticated user.
    """
    contacts = db.query(Contact).filter(Contact.owner_id == current_user.id).all()
    return contacts

@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def add_contact(
    request: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a new contact by looking up their username or phone number.
    Rejects if already added, or if attempting to add self.
    """
    identifier = request.contact_identifier.strip()
    
    # 1. Look up contact user by phone or username
    contact_user = db.query(User).filter(
        (User.username == identifier) | 
        (User.phone_number == identifier)
    ).first()
    
    if not contact_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found with the provided phone or username"
        )
        
    # 2. Reject if adding self
    if contact_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a contact"
        )
        
    # 3. Reject if already in contacts
    existing_contact = db.query(Contact).filter(
        Contact.owner_id == current_user.id,
        Contact.contact_user_id == contact_user.id
    ).first()
    
    if existing_contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already in your contacts"
        )
        
    # 4. Create and save new contact relationship
    new_contact = Contact(
        owner_id=current_user.id,
        contact_user_id=contact_user.id
    )
    
    try:
        db.add(new_contact)
        db.commit()
        db.refresh(new_contact)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while adding contact: {str(e)}"
        )
        
    return new_contact

@router.get("/search", response_model=List[ContactRead])
def search_contacts(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Searches the authenticated user's contact list by username or display name.
    """
    search_query = f"%{q.strip()}%"
    contacts = db.query(Contact).join(User, Contact.contact_user_id == User.id).filter(
        Contact.owner_id == current_user.id,
        (User.display_name.ilike(search_query)) | (User.username.ilike(search_query))
    ).all()
    return contacts
