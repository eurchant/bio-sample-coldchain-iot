import machine
import time

print("Light sensor test start")

ldr = machine.ADC(machine.Pin('C5'))

while True:
    value_16bit = ldr.read_u16()
    value_12bit = value_16bit >> 4
    voltage = value_12bit * 3.3 / 4096

    print("light raw:", value_16bit, "voltage:", voltage)
    time.sleep(1)