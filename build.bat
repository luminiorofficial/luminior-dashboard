@echo off

cd /c C:\Users\DESKTOP COMPANY\Documents\GitHub\luminior-dashboard

call git pull
call docker rmi luminior-crm

call docker build --no-cache -t luminior-crm .

call docker save -o luminior-crm.tar luminior-crm

pause