"""
FAME-GENIX Edge Physical AI & Ambient Hardware Hub:
Supports WebBluetooth BLE handshakes for Smart Masks & Helmets,
and Ambient CCTV Fall / Skeleton Vision Event Ingestion.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.db.models import DeviceType


class BLEGATTService(BaseModel):
    service_uuid: str
    service_name: str
    characteristics: List[Dict[str, str]]


class DiscoveredBluetoothPeripheral(BaseModel):
    device_id: str
    device_name: str
    hardware_type: str  # FAME_MASK | FAME_HELMET | SMART_RING | AMBIENT_CCTV
    rssi_dbm: int
    mac_address_masked: str
    battery_percent: int
    firmware_version: str
    gatt_services: List[BLEGATTService]
    pairing_status: str  # UNPAIRED | PAIRED | CONNECTED | STREAMING


# Simulated Real-World Edge Device Peripherals for WebBluetooth Scans
DEFAULT_PERIPHERALS: List[DiscoveredBluetoothPeripheral] = [
    DiscoveredBluetoothPeripheral(
        device_id="BLE-FAME-MASK-PRO-881",
        device_name="FAME Smart Mask v2.0 (Dual-Sensor)",
        hardware_type=DeviceType.FAME_MASK,
        rssi_dbm=-54,
        mac_address_masked="E4:5F:01:**:**:B1",
        battery_percent=92,
        firmware_version="v2.4.1-edge-npu",
        gatt_services=[
            BLEGATTService(
                service_uuid="0000180d-0000-1000-8000-00805f9b34fb",
                service_name="Heart Rate & Pulse Oximetry Service",
                characteristics=[
                    {"uuid": "00002a37-0000-1000-8000-00805f9b34fb", "name": "Heart Rate Measurement (BPM)"},
                    {"uuid": "00002a5f-0000-1000-8000-00805f9b34fb", "name": "SpO2 Oxygen Concentration (%)"},
                ]
            ),
            BLEGATTService(
                service_uuid="0000ff01-0000-1000-8000-00805f9b34fb",
                service_name="Respiratory VOC & Airflow Sensor",
                characteristics=[
                    {"uuid": "0000ff02-0000-1000-8000-00805f9b34fb", "name": "Exhaled Volatile Organic Compounds (ppm)"},
                    {"uuid": "0000ff03-0000-1000-8000-00805f9b34fb", "name": "Minute Respiratory Rate (bpm)"},
                ]
            )
        ],
        pairing_status="UNPAIRED"
    ),
    DiscoveredBluetoothPeripheral(
        device_id="BLE-FAME-HELMET-IMU-402",
        device_name="FAME Smart Helmet (Impact & Heat Strain)",
        hardware_type=DeviceType.FAME_HELMET,
        rssi_dbm=-68,
        mac_address_masked="A8:20:66:**:**:44",
        battery_percent=85,
        firmware_version="v1.8.0-arm-cortex",
        gatt_services=[
            BLEGATTService(
                service_uuid="0000181a-0000-1000-8000-00805f9b34fb",
                service_name="Environmental & Core Temperature Sensing",
                characteristics=[
                    {"uuid": "00002a6e-0000-1000-8000-00805f9b34fb", "name": "Tympanic Infrared Body Temperature (°C)"},
                ]
            ),
            BLEGATTService(
                service_uuid="0000fe10-0000-1000-8000-00805f9b34fb",
                service_name="6-Axis IMU High-G Impact & G-Force Vector",
                characteristics=[
                    {"uuid": "0000fe11-0000-1000-8000-00805f9b34fb", "name": "Peak Impact Force (G) & Fall Alert"},
                ]
            )
        ],
        pairing_status="UNPAIRED"
    ),
    DiscoveredBluetoothPeripheral(
        device_id="VISION-CCTV-ER-ROOM-1",
        device_name="Apex Care Ambient Fall-Detection Vision Hub",
        hardware_type=DeviceType.FAME_VISION,
        rssi_dbm=-48,
        mac_address_masked="3C:52:82:**:**:09",
        battery_percent=100,  # AC Mains
        firmware_version="v3.1.2-nvidia-jetson",
        gatt_services=[
            BLEGATTService(
                service_uuid="0000cc01-0000-1000-8000-00805f9b34fb",
                service_name="Pose Estimation & Skeleton Tracking",
                characteristics=[
                    {"uuid": "0000cc02-0000-1000-8000-00805f9b34fb", "name": "Sudden Fall Event & Immobility Alert"},
                ]
            )
        ],
        pairing_status="UNPAIRED"
    )
]


class EdgeDeviceManager:
    """Manages WebBluetooth scanning, simulated pairing state, and vision stream events."""

    def __init__(self):
        self.devices: Dict[str, DiscoveredBluetoothPeripheral] = {d.device_id: d for d in DEFAULT_PERIPHERALS}
        self.paired_device_ids: set = set()

    def scan_nearby(self) -> List[Dict[str, Any]]:
        return [d.model_dump() for d in self.devices.values()]

    def pair_device(self, device_id: str) -> Dict[str, Any]:
        if device_id not in self.devices:
            return {"status": "ERROR", "message": f"Device {device_id} not discovered in range."}
        d = self.devices[device_id]
        d.pairing_status = "CONNECTED"
        self.paired_device_ids.add(device_id)
        return {
            "status": "SUCCESS",
            "device_id": d.device_id,
            "device_name": d.device_name,
            "pairing_status": d.pairing_status,
            "battery_percent": d.battery_percent,
            "firmware_version": d.firmware_version,
            "active_services": len(d.gatt_services),
            "message": f"Successfully paired and established BLE GATT streaming with {d.device_name}."
        }

    def unpair_device(self, device_id: str) -> Dict[str, Any]:
        if device_id in self.devices:
            self.devices[device_id].pairing_status = "UNPAIRED"
            self.paired_device_ids.discard(device_id)
        return {"status": "SUCCESS", "device_id": device_id, "pairing_status": "UNPAIRED"}

    def ingest_vision_fall_alert(
        self,
        cctv_id: str,
        patient_id: str,
        confidence: float,
        posture: str = "PROSTRATE_UNRESPONSIVE"
    ) -> Dict[str, Any]:
        """Ingests Ambient CCTV Edge skeleton detection fall event."""
        return {
            "event_id": f"FALL-EVT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "cctv_id": cctv_id,
            "patient_id": patient_id,
            "confidence_score": confidence,
            "detected_posture": posture,
            "timestamp": datetime.utcnow().isoformat(),
            "trigger_action": "EMERGENCY_FALL_DISPATCH_REQUIRED",
            "provenance": "AMBIENT_EDGE_VISION_NPU"
        }


edge_device_manager = EdgeDeviceManager()
