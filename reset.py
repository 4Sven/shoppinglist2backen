#!/usr/bin/python
# -*- coding: latin1 -*-

from Adafruit_Thermal import *

global printer
printer = Adafruit_Thermal("/dev/ttyS3", 19200, timeout=5)

printer.setDefault() # Restore printer to defaults

#printer.sleep()      # Tell printer to sleep
#printer.wake()       # Call wake() before printing again, even if reset
#printer.setDefault() # Restore printer to defaults
