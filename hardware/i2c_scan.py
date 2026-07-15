import machine
import time

print("I2C scan start")

i2c = machine.I2C(1, freq=400000)

devices = i2c.scan()

print("I2C devices:", devices)

for dev in devices:
    print("hex:", hex(dev))

print("I2C scan done")