# Soil probe: primary-source research and fault-isolation plan

**Research date:** 10 October 2026. **Scope:** the user's pictured five-prong,
four-wire soil probe, pictured MAX485 module, and a separate AGREM SYSTEMS
example sketch supplied by another builder. This note does **not** establish
that the AGREM sketch was written for this exact probe.

**Supplier-manual update:** The generic V2.2 manual delivered after this
initial research states 9600 8N1, default address 2, function 03, and a
register table with pH at 7. Its address examples contradict its stated
default and are not proof of this unit's settings. See
[the product-specific update](microscale-probe-protocol-research.md) and the
[read-only diagnostic](../code/diagnostics/soil-probe/README.md). The older
4800/address-1/no-response result cannot establish a probe defect.

## What is established, and what is not

- The probe label and wiring supplied by the user identify an RS-485 output,
  red supply, black ground, yellow A, and green B. Its marked measurement
  options appear to include EC, pH, and NPK. The label is not a protocol manual:
  it does not establish a Modbus address, baud rate, parity, register map,
  signedness, scaling, units, or whether temperature/moisture are populated.
- RS-485 specifies the electrical interface, **not** an application protocol.
  Modbus can run over RS-485, but the two are not synonymous; the
  [Modbus Organization introduction](https://www.modbus.org/introduction-to-modbus)
  describes Modbus as compatible with several underlying interfaces.
- No first-party model-specific register table or manual for this exact probe
  was verified in this search. Manuals for visually similar seven-in-one
  sensors are not evidence that its registers match this one. Obtain the
  probe's model number and seller/manufacturer protocol sheet before decoding
  any response as pH or NPK.
- The current Project AVATAR repository declares RS-485 UART/direction pins
  but does not yet implement a soil-probe reader. A standalone transaction
  test is therefore the correct next software boundary, not the dashboard.

## Verified electrical facts

| Fact | Why it matters |
| --- | --- |
| The [MAX485 product page](https://www.analog.com/en/products/max485.html) specifies a single 5 V supply; its [datasheet](https://www.analog.com/MAX481/datasheet) specifies receiver-output levels in that 5 V domain. | Do **not** connect the module's `RO` to an ESP32 RX pin without a suitable 5 V-to-3.3 V level shift or a verified 3.3 V-compatible replacement transceiver. Do not assume the photographed MAX485 board is safe at 3.3 V just because the ESP32 is. |
| The [MAX485 datasheet](https://www.analog.com/MAX481/datasheet) defines `DE` as active-high driver enable and `/RE` as active-low receiver enable. | When tied together, LOW means receive and HIGH means transmit. Set the direction pin LOW before polling; assert HIGH only for the query; return LOW after the final transmitted bit. |
| The [Espressif ESP32 UART documentation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/uart.html) confirms separate configurable UARTs and shows a manual half-duplex DE/`/RE` arrangement. | `Serial2` is appropriate on a classic ESP32 if its RX/TX pins and UART format match the wiring. Do not connect the probe A/B wires directly to UART RX/TX; the transceiver is required. |
| The [ESP32 hardware guide](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html) recommends a 3.3 V logic supply; the [ESP32 datasheet, Table 5-3](https://documentation.espressif.com/esp32_datasheet_en.html) limits high-level GPIO input to VDD + 0.3 V. | Treat ESP32 GPIO as 3.3 V-domain and avoid 5 V logic at RX. Confirm the actual `RO` voltage and level-shifter output with a meter before connection. |
| The [Analog Devices RS-485 application note](https://www.analog.com/en/resources/app-notes/an-960.html) describes the differential A/B pair; [TI's interface discussion](https://e2e.ti.com/support/interface-group/interface/f/interface-forum/1321330/ds16f95qml-polarity-issue-for-a-b-positive-negative) explains that A/B conventions can conflict across parts. | A/B polarity, open/short connections, missing ground reference, and noise are physical-layer checks. If pin labels conflict between the probe and converter, power off before trying an A/B swap. |

The user's power topology already includes a regulated 12 V rail and a
regulated 5 V rail. The probe's label permits a broad supply range, but verify
the actual voltage at its red/black wires under load. Do not infer that 12 V on
the probe means 12 V on the MAX485 logic board: the latter is a 5 V part.

## What the supplied AGREM example actually does

The supplied code's UART call is `Serial2.begin(4800, SERIAL_8N1, 16, 17)`;
its comment maps MAX485 `RO`→GPIO16, `DI`←GPIO17, `RE`←GPIO19, and
`DE`←GPIO18. Its seven fixed request frames assume slave address `0x01`,
function `0x03` (read holding registers), and register addresses `0x0000`
through `0x0006`. Independent CRC calculation confirms all **request** CRC
bytes are internally correct. This validates the frame arithmetic, **not**
the address or register map for the user's particular probe. The
[Modbus application specification, §6.3](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf)
defines function `0x03` and zero-based register addresses; the
[Modbus serial specification, §2.5](https://www.modbus.org/file/secure/modbusoverserial.pdf)
defines RTU framing and low-byte-first CRC order.

The example is not a reliable diagnostic reader as written:

1. It returns `values[3] << 8 | values[4]` after a fixed timeout even if zero,
   one, or two bytes arrived. Earlier values remain in the reused buffer, so a
   timeout can masquerade as a plausible or repeated measurement.
2. It does not check reply length, slave address, function, byte count, or
   **reply CRC** before interpreting bytes. For one register, a normal Modbus
   RTU reply would be seven bytes (`address`, `0x03`, `0x02`, two data bytes,
   two CRC bytes); an exception response has a different shape. This follows
   the [application specification](https://www.modbus.org/file/secure/modbusprotocolspecification.pdf)
   and [serial framing specification](https://www.modbus.org/file/secure/modbusoverserial.pdf).
3. `values` is `int16_t[11]`, but the loop allows `byteCount < sizeof(values)`.
   On this target that compares against 22 **bytes**, although the array has
   only 11 elements. Enough received bytes could write beyond the array.
4. The receive buffer is not cleared before each request. Old late bytes can
   become the apparent start of the next response. Each read waits up to
   500 ms regardless of whether a complete validated frame arrived.
5. The later `if (total == i);` ends the conditional immediately. The following
   block runs regardless of `total`, and its `return` leaves the loop after its
   first iteration. This is not a sensor electrical fault, but it makes the
   original sample workflow misleading.
6. The sketch contains live-looking Wi-Fi and email credentials. They are
   deliberately omitted here. The credential owner should revoke/rotate them;
   do not paste the sample wholesale into the project or publish serial logs
   containing secrets.

The user's DHT11-only sketch reads **air** humidity/temperature on GPIO4. It
does not query the soil probe. Furthermore, the current Project AVATAR pin
proposal uses GPIO4 for tied RS-485 `DE`/`/RE` and GPIO13 for DHT11. A DHT11
test on GPIO4 is fine **only while that RS-485 direction connection is
disconnected**; otherwise the two functions conflict. The DHT sketch's
`Serial.begin(19200)` is the computer log speed, not a setting for the separate
soil-sensor UART; match the Serial Monitor to the *flashed* sketch's `Serial`
baud (`19200` for the DHT sketch, `115200` for the AGREM example).

## Safe diagnostic matrix

Run this with pumps, servo, and other sensor modules disconnected. First
validate rails, common ground, and level shifting with power off/on checks;
then run a minimal serial test that logs request and reply **hex bytes and
length**, never calculated NPK values from unchecked bytes. The test should
report `timeout`, `short frame`, `CRC error`, `exception`, or `valid frame`
separately. Do not issue write-register commands while identifying the probe.

| Observation | Most likely next check | Do not conclude |
| --- | --- | --- |
| No response bytes | Measure voltage at probe red/black and MAX485 VCC/GND; verify shared ground and `RO` level shift; verify `RO`→RX16, `DI`←TX17, and direction pin actually matches the flashed sketch. Then confirm serial settings and device address from the probe manual; with power removed, test A/B polarity. | “The NPK sensor is broken.” |
| Repeating `FF`, `00`, or garbled bytes | Check actual UART baud/parity/stop settings, A/B wiring, ground, and electrical levels; view raw bytes before any scaling. | “The register is zero.” |
| Reply begins `01 83 ...` with a valid CRC | This is a Modbus exception to function `0x03`; inspect its exception code and the probe's register/function documentation. | “The sensor has no nutrients.” |
| Seven bytes, `01 03 02 ...`, valid CRC | Transport and this one-register query worked. Only now interpret the two data bytes against the *exact* probe register table and units. | “Register 0 means moisture” without the manual. |
| Some registers answer, others do not | Confirm model options marked on the probe and each supported address/function with its manual. A firmware variant may omit unmarked parameters. | “All seven AGREM parameters exist on this probe.” |
| CRC errors or intermittent replies | Inspect bus wiring, ground/reference, electrical loading, cable length/routing, and timing; check the physical implementation against the [Modbus serial guide](https://www.modbus.org/file/secure/modbusoverserial.pdf). | “A calibration problem.” |
| Valid raw data but implausible units | Confirm signedness, scale factors, register offset, probe placement, and calibration/reference measurements from manufacturer instructions. | “The communication signal is wrong.” |

**Information needed to finish the diagnosis:** exact model/seller manual or
register sheet; clear photo of the complete label and converter wiring; probe
and MAX485 supply voltages; whether the ESP32 RX is level-shifted; exact serial
monitor output in hex (including byte count) from one read-only request; and
which sketch is flashed during that capture. This evidence determines whether
the fault is power/wiring, UART settings, protocol mismatch, parsing, or actual
sensor measurement.
