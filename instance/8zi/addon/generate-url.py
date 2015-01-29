#encoding:utf-8
import datetime

d = datetime.datetime(2015, 3, 6)
ar = []
for x in range(1,1800):
    d1 = d + datetime.timedelta(hours=x)
    ar.append(u'''http://www.meimingteng.com/m/apps/bazi.aspx?__VIEWSTATE=%%2FwEPDwUKMTA2MzE0NzA3OGRkSlWb4XuVUApmVAoOx6aU85PUNUM%%3D&from=&ctl00%%24ContentPlaceHolder1%%24tbBirth=2015-%02d-%02d+%02d%%3A00&ctl00%%24ContentPlaceHolder1%%24btSubmit=%%E5%%BC%%80%%E5%%A7%%8B%%E5%%88%%86%%E6%%9E%%90'''%(d1.month,d1.day,d1.hour))

fileHandle = open('urls.txt', 'w')
fileHandle.write ('%s'%ar)
fileHandle.close()
