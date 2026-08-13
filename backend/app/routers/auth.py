from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.models import User
from app.schemas.schemas import (
    RegisterRequest,
    VerifyOtpRequest,
    LoginRequest,
    TokenResponse,
    UserUpdate,
    UserRead,
)
from app.core.security import create_access_token, get_current_user

router = APIRouter(tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user. Rejects if the phone or username is already taken.
    """
    # Check if user already exists (by username or phone)
    db_user = db.query(User).filter(
        (User.username == request.phone_or_username) | 
        (User.phone_number == request.phone_or_username)
    ).first()
    
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or phone number is already registered"
        )
    
    # Simple heuristic to determine if input is a phone number or username
    username = request.phone_or_username.strip()
    phone_number = None
    if username.startswith("+") or username.isdigit():
        phone_number = username
    
    new_user = User(
        username=username,
        phone_number=phone_number,
        display_name=request.display_name.strip(),
        avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
        is_online=False,
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during registration: {str(e)}"
        )
        
    return {"message": "User registered successfully. Proceed to OTP verification."}

@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(request: VerifyOtpRequest, db: Session = Depends(get_db)):
    """
    Verifies a mock OTP code (accepts only 123456) and returns a session JWT.
    """
    user = db.query(User).filter(
        (User.username == request.phone_or_username) | 
        (User.phone_number == request.phone_or_username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first."
        )
        
    if request.otp != "123456":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP verification code"
        )
        
    # Mark user online
    user.is_online = True
    db.commit()
    db.refresh(user)
    
    # Generate JWT
    token = create_access_token(data={"sub": user.username})
    return {"token": token, "user": user}

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Triggers the login flow. Verifies that the user exists and prompts for OTP.
    """
    user = db.query(User).filter(
        (User.username == request.phone_or_username) | 
        (User.phone_number == request.phone_or_username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register first."
        )
        
    return {
        "status": "otp_sent",
        "message": "OTP verification code sent",
        "phone_or_username": request.phone_or_username
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Sets the current user status to offline.
    """
    current_user.is_online = False
    db.commit()
    return {"message": "Logged out successfully"}

@router.get("/users/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns profile information for the authenticated user.
    """
    return current_user

@router.patch("/users/me", response_model=UserRead)
def update_me(request: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Updates profile details (display name or avatar url).
    """
    if request.display_name is not None:
        current_user.display_name = request.display_name.strip()
    if request.avatar_url is not None:
        current_user.avatar_url = request.avatar_url
        
    db.commit()
    db.refresh(current_user)
    return current_user
