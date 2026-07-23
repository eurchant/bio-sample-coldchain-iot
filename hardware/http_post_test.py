import time
import json
import urequests
from quectel import Network

TEST_URL = "http://httpbin.org/post"

print("=== HTTP POST test start ===")

net = Network()

try:
    print("[1] init network")
    net.init()

    print("[2] check SIM")
    if not net.query_usim():
        print("SIM error")
        raise Exception("SIM not ready")

    print("[3] attach network")
    net.attach()

    print("[4] wait connected")
    connected = False
    for i in range(20):
        if net.is_connected():
            connected = True
            print("network connected")
            break
        print("waiting...", i + 1)
        time.sleep(1)

    if not connected:
        raise Exception("network not connected")

    data = {
        "device_id": "CLD-001",
        "task_id": "TASK-001",
        "temperature": 26.4,
        "humidity": 61.0,
        "light_raw": 16000,
        "box_status": "BOX_OPEN",
        "move_status": "STABLE",
        "temp_status": "TEMP_OK"
    }

    headers = {
        "Content-Type": "application/json"
    }

    print("[5] HTTP POST:", TEST_URL)
    print("payload:", data)

    response = None
    try:
        response = urequests.post(
            TEST_URL,
            data=json.dumps(data),
            headers=headers
        )

        print("status:", response.status_code)
        print("text:", response.text[:300])

        if response.status_code == 200:
            print("HTTP POST OK")
        else:
            print("HTTP POST returned non-200")

    except Exception as e:
        print("HTTP POST failed:", e)

    finally:
        if response:
            response.close()

finally:
    net.deinit()
    print("=== HTTP POST test done ===")