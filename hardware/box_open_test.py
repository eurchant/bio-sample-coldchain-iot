import machine
import time

print("Box open detection test start")

ldr = machine.ADC(machine.Pin('C5'))

OPEN_THRESHOLD = 38000

while True:
    raw = ldr.read_u16()
    voltage = (raw >> 4) * 3.3 / 4096

    if raw < OPEN_THRESHOLD:
        status = "BOX OPEN"
    else:
        status = "BOX CLOSED"

    print("light raw:", raw, "voltage:", voltage, "status:", status)

    time.sleep(1)