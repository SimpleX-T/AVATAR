# Microscale five-in-one soil probe: product-specific protocol evidence

**Checked:** 10 October 2026. **Scope:** the [exact Microscale product and
variant supplied by the user](https://www.microscale.net/products/5-in-1-npk-electrical-conductivity-ph-sensor?variant=54274631106835).
This supplements, rather than replaces,
[the broader soil-probe fault-isolation note](soil-probe-primary-source-research.md).

**10 October update:** The supplier has now provided the local file
`/home/devtochukwu/Downloads/Soil_Multi-Parameter_Sensor_Manual_EN_V2_2.pdf`.
It is a **generic multi-parameter manual**, not a serial-number-specific
confirmation. Section 7 states Modbus RTU, 9600 baud, 8N1, default slave
address `02`, function `03`, and pH at register `0007`. Its example text
says address 1 while the actual example request starts with address `00`, so
the examples are internally inconsistent. We now test `02 03 00 07 00 01 35
F8` as a **read-only hypothesis**. The previous 4800/address-1/register-0
test did not test these supplier-stated settings. No valid response from this
exact probe has yet established its working parameters.

## Verified from the seller

The product page names it **“RS485 5-in-1 Soil Sensor – NPK, pH, Electrical
Conductivity (EC)”** and displays a five-prong, black-bodied probe with a blue
label and red/black/yellow/green conductors. Its appearance is consistent with
the user's photographs, although visual similarity alone cannot establish a
factory model or firmware revision. Source: [Microscale product
page](https://www.microscale.net/products/5-in-1-npk-electrical-conductivity-ph-sensor?variant=54274631106835).

The complete technical description visible on that listing is **“Manual will
be provided.”** The page does **not** publish or link a manual, model number,
power specification, serial format, baud rate, parity, default slave address,
Modbus function code, register map, or example command. The pictured label,
which the user supplied separately, marks **3.3–24 V** and **485** output, but
it likewise lacks serial/protocol settings. Sources: [Microscale product
page](https://www.microscale.net/products/5-in-1-npk-electrical-conductivity-ph-sensor?variant=54274631106835);
user-supplied probe-label photograph and transcription in this task.

Microscale also sells a **different** [“RS485 Soil NPK Sensor
Probe”](https://www.microscale.net/products/npk-sensor), whose listing says
**9–24 VDC** and includes other specifications. Do not transfer its voltage
rating—or any guessed protocol settings—to this five-in-one item. The two
product URLs and titles are distinct; the five-in-one's own label takes
precedence for its stated supply range. Sources: both linked Microscale
product pages; user-supplied probe label.

## Diagnostic conclusion

The user's static MAX485 test gave `A−B = +2.90 V, RO = 5.10 V` with `DI`
high, and `A−B = −2.89 V, RO = 0.06 V` with `DI` low. That supports a working
driver and receiver in static conditions; it does not verify serial timing or
the probe's behavior. Source: user's reported measurements in this task.

The repeated `01 03 00 00 00 01 84 0A` query is a syntactically valid Modbus
RTU read of one holding register from slave 1. It is **not verified as a valid
query for this Microscale probe**: its address, baud rate, function, and first
register came from third-party AGREM example code, not this product's manual.
The [Modbus serial-line specification](https://www.modbus.org/file/secure/modbusoverserial.pdf)
defines RTU framing and CRC, while the [Modbus application protocol
specification](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf)
defines function 03; neither supplies a device-specific register map.

The manual is now available, but a reply from this unit remains decisive.
Ask the seller to confirm that the generic V2.2 settings apply to the purchased
five-in-one SKU, and request one known-good request/response in hex for that
specific model. A matching printed model or serial label would improve the
link between the generic manual and this exact unit. A no-response result
under the older borrowed settings does not establish a faulty probe.
