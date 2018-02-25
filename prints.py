# -*- coding: UTF-8 -*-

def convertUmlauts( str ):
  str = str.replace("ä",'\x84');
  str = str.replace("ö",'\x94');
  str = str.replace("ü",'\x81');
  str = str.replace("Ä",'\x8A');
  str = str.replace("Ö",'\x99');
  str = str.replace("Ü",'\x9A');
  str = str.replace("ß",'\xE1');
  str = str.replace("(r)",'\xA9');
  str = str.replace("(c)",'\xB8');
  str = str.replace("(C)",'\xB8');
  str = str.replace("3/4",'\xF3');
  str = str.replace("1/2",'\xAB');
  str = str.replace("1/4",'\xAC');
  return str;

def printHead(printer):
  printer.setSize('M');
  return;

def printItem(printer):
  printer.setSize('S');
  return;

def putLine( str , printer):
  printer.println(convertUmlauts(str));
  return
