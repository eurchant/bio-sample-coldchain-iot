import time
import urequests
from quectel import Network

TEST_URL = "http://example.com/"

print("=== HTTP GET test start ===")

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
    for i in range(20):
        if net.is_connected():
            print("network connected")
            break
        print("waiting...", i + 1)
        time.sleep(1)

    print("[5] HTTP GET:", TEST_URL)

    response = None
    try:
        response = urequests.get(TEST_URL)
        print("status:", response.status_code)
        print("text:", response.text[:200])

        if response.status_code == 200:
            print("HTTP GET OK")
        else:
            print("HTTP GET returned non-200")
    except Exception as e:
        print("HTTP GET failed:", e)
    finally:
        if response:
            response.close()

finally:
    net.deinit()
    print("=== HTTP GET test done ===")