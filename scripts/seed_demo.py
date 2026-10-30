"""
Seed authorized system users and initial patient profile with a healthy baseline
and registered FAME Mask simulation hardware interface.

Usage:
    python scripts/seed_demo.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.models import (Device, DeviceStatus, DeviceType, Doctor, Patient,
                            Role, User)
from app.db.session import SessionLocal, init_db
from app.core.security import hash_password

SYSTEM_PASSWORD = "FameGenix#2026"

INITIAL_USERS = [
    {"email": "patient@famegenix.org", "role": Role.PATIENT, "full_name": "John Doe"},
    {"email": "doctor@famegenix.org", "role": Role.DOCTOR, "full_name": "Dr. Sarah Jenkins"},
    {"email": "emergency@famegenix.org", "role": Role.EMERGENCY_OPERATOR, "full_name": "Emergency Dispatch Operations"},
    {"email": "ambulance@famegenix.org", "role": Role.AMBULANCE_TEAM, "full_name": "Ambulance Response Unit 01"},
    {"email": "admin@famegenix.org", "role": Role.SYSTEM_ADMIN, "full_name": "System Administrator"},
]


def main():
    init_db()
    db = SessionLocal()
    try:
        created_patient_id = None

        for spec in INITIAL_USERS:
            # Check for current or legacy email
            legacy_email = spec["email"].replace("@famegenix.org", "@famegenix.demo")
            existing = db.query(User).filter((User.email == spec["email"]) | (User.email == legacy_email)).first()
            if existing:
                if existing.email != spec["email"]:
                    existing.email = spec["email"]
                    existing.password_hash = hash_password(SYSTEM_PASSWORD)
                    db.commit()
                    print(f"[seed] updated legacy user to {spec['email']}")
                else:
                    print(f"[seed] {spec['email']} already exists, skipping.")

                if spec["role"] == Role.PATIENT:
                    p = db.query(Patient).filter(Patient.user_id == existing.id).first()
                    created_patient_id = p.id if p else created_patient_id
                continue

            user = User(email=spec["email"], password_hash=hash_password(SYSTEM_PASSWORD), role=spec["role"])
            db.add(user)
            db.flush()

            if spec["role"] == Role.PATIENT:
                patient = Patient(user_id=user.id, full_name=spec["full_name"], date_of_birth="1998-04-12",
                                   sex="Male", known_conditions="Mild Asthma",
                                   emergency_contact_name="Jane Doe", emergency_contact_phone="+1 (555) 234-5678")
                db.add(patient)
                db.flush()
                created_patient_id = patient.id
            elif spec["role"] == Role.DOCTOR:
                db.add(Doctor(user_id=user.id, full_name=spec["full_name"], specialty="Pulmonology & Critical Care"))

            db.commit()
            print(f"[seed] created {spec['email']} ({spec['role']})")

        if created_patient_id:
            existing_device = db.query(Device).filter(Device.patient_id == created_patient_id,
                                                        Device.type == DeviceType.FAME_MASK).first()
            if not existing_device:
                device = Device(patient_id=created_patient_id, type=DeviceType.FAME_MASK,
                                 status=DeviceStatus.NOT_CONNECTED)
                db.add(device)
                db.commit()
                print(f"[seed] registered FAME_MASK device {device.id} for patient {created_patient_id}")
            else:
                print(f"[seed] FAME_MASK device already registered: {existing_device.id}")

        print("\n[seed] Authorized profile credentials:")
        for spec in INITIAL_USERS:
            print(f"  {spec['email']} / {SYSTEM_PASSWORD}")

    finally:
        db.close()


if __name__ == "__main__":
    main()

