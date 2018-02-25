#!/usr/bin/python
# -*- coding: latin1 -*-

from Adafruit_Thermal import *
import items

global printer
printer = Adafruit_Thermal("/dev/ttyS3", 19200, timeout=5)

printer.setDefault() # Restore printer to defaults

#printer.setSize('L')
#printer.println("Einkaufszettel")

#printer.setDefault() # Restore printer to defaults

items.printShoppingQueue(printer)

printer.feed(2)

#printer.sleep()      # Tell printer to sleep
#printer.wake()       # Call wake() before printing again, even if reset
printer.setDefault() # Restore printer to defaults
