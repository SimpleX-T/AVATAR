# Uno soil probe after stabilization — 12 October 2026

User confirms probe remained in soil for more than five minutes. Repeated the
same read-only ModbusMaster test at 9600/8N1, address 2, function 03, one register
per request. USB port /dev/ttyUSB0; firmware banner verified. No reflash,
configuration writes or actuator commands.

All ten transactions passed library and independent frame/CRC checks. Two
reads each: register7=65, register2=11, register4=0, register5=0, register6=1.
Results match the first soil capture exactly. Supplier-manual interpretations
remain provisional: pH6.5, EC11µS/cm, N0/P0/K1mg/kg.

[Raw capture](uno-soil-stabilized-test-2026-10-12.log).

This confirms repeatable communication and unchanged register outputs after
the reported settling period. It does not establish calibrated pH/EC or
independently valid NPK measurements. Soil moisture, full electrode contact,
reference values and electrical supply measurements remain unverified. The
zero nutrient registers must not be interpreted as proof of nutrient-free soil.

User subsequently identified the sample as **sandy soil**. No measured moisture,
reference nutrient analysis or reference EC/pH is available. Preserve this sample
context for later comparisons; soil type alone does not validate the readings.
