# Comparable systems research

Research date: 11 October 2026. Baseline supplied for comparison: AVATAR combines ESP32, RS485 soil pH/EC/NPK, soil moisture, DHT11, LDR, MQ-6 and flame sensing, irrigation, a separate servo-directed fire suppression mechanism, battery power, and local/offline control with a dashboard.

## Finding

Public projects demonstrate substantial portions of this architecture. The sources reviewed do **not establish an exact match for the complete combination**. This is a bounded public-source search, not proof that no such system exists anywhere. Features not documented below are unverified rather than necessarily absent. Repository descriptions and paper claims are not independent validation of field performance.

## Closest documented examples

| System | Verified overlap | Material differences / unknowns | Available material |
|---|---|---|---|
| **Smart Farming with Automation**, Sanjivani K. B. P. Polytechnic, India, March–April 2026 | ESP32; moisture, temperature/humidity, gas and flame sensing; automated irrigation; servo; OLED | Servo operates a rain-protection shed, not a fire nozzle. Circuit section specifies DHT11 and MQ-135. Experimental section also says DHT22 and “possibly pH,” an internal inconsistency. No demonstrated RS485 NPK/EC or separate fire suppression loop. | [Six-page paper with setup photograph, block/circuit diagrams](https://www.ijeeejournal.org/wp-content/uploads/2026/04/SMART-FARMING-WITH-AUTOMATION.pdf) |
| **Smart-Agri-Rover**, Raghav Chandak | Moisture and flame sensors; automatic irrigation and fire-triggered water pumping; servo-directed spray; battery power; local controller | Arduino Uno mobile rover using Bluetooth and LCD. Two servos position moisture sensor and spray. Nutrient sensing, ESP32 web dashboard and dedicated separate fire pump are not documented. | [Author's repository and component/operation documentation](https://github.com/Raghav-chandak/Smart-Agri-Rover) |
| **IoT Smart Farming ESP32**, Sanjeev Kumar Shah | ESP32, DHT11, moisture, gas sensing, relay pump, servo, local HTTP dashboard and Blynk | Servo deploys rain cover; gas threshold logs fire/gas alert. The documentation does not establish flame sensor, suppression nozzle, RS485 pH/EC/NPK, or tested battery/offline operation. | [Repository with firmware-oriented documentation and dashboard architecture](https://github.com/SANJEEVKUMARSHAH/iot-smart-farming-esp32) |
| **Smart Soil Monitoring System**, n-chomphob | ESP32, MAX485, Modbus RTU 7-in-1 probe measuring N/P/K, pH, EC, moisture and soil temperature; embedded web server, captive portal, local measurement records | Closest soil electronics/dashboard match. The documented hardware contains buzzer and boost converter, but no irrigation or fire suppression. Ambient DHT11, LDR, MQ-6 and flame sensing are not documented. | [Code, wiring diagram, block diagram, dashboard and hardware photograph](https://github.com/n-chomphob/smart-soil-monitoring-system) |
| **Fire detection and anti-fire system to enhance food security**, Morchid et al., Scientific African 27, March 2025 | Agricultural smoke/flame detection, automatic firefighting pumps, real-time visualization and alerts | Raspberry Pi and MCP3208 ADC with MQTT, ThingSpeak, MATLAB and SMTP. This is a fire protection system; it does not document AVATAR's soil nutrient/irrigation stack or servo targeting. | [Open-access research article](https://doi.org/10.1016/j.sciaf.2025.e02559), [institutional PDF](https://qspace.qu.edu.qa/bitstream/handle/10576/65649/1-s2.0-S2468227625000304-main.pdf?sequence=1) |

The first example is close to AVATAR's environmental sensor integration; the rover is close to its combination of watering and fire response; the soil repository is close to its RS485 nutrient sensing and local dashboard. None of those sources verifies all three together.

## Further primary-source leads

- [TerraNex, AgroNext](https://agronext.net/en/terranex): developer describes ESP32, capacitive moisture and analog pH, RS485/Modbus NPK, irrigation and nutrient dosing on separate relays, capped run times and watchdog. EC and fire suppression are not established by this page. Search-index text was available; direct page fetch failed.
- [AgriOT, Abdul Haseeb](https://abdul2k10023.github.io/htmRusher/projects/agri.html): developer describes ESP32 RS485 greenhouse nodes, moisture/pH/NPK, ambient humidity/temperature and light, MQTT, OTA and Grafana. Useful multisensor comparison; direct page fetch failed and fire suppression is not documented in the retrieved text.
- [Irrigate Smart](https://irrigatesmart.futureaware.tech/): parent researcher identified this project by Eeshah Qamar, Zohaib Altaf and Abu Bakar as Raspberry Pi 4 irrigation with moisture, temperature/humidity, smoke/CO/CO2 sensing, dashboard and reduced cloud dependence. Nutrient sensing is unconfirmed. This lead was supplied by the coordinating researcher and was not independently re-read in this research pass.

## Videos and evidence limits

- Smart-Agri-Rover README links a [Drive demo](https://drive.google.com/file/d/1lS3v3zLEF5gMKj5gfEhwvtU1Y9bMLXQP/view?usp=sharing). The retrieved page required sign-in and had the title “Home security system demo.mp4.” It is therefore **not a verified accessible rover demonstration**.
- Parent researcher supplied [robosap video](https://www.youtube.com/watch?v=MYU0TGQ_S-I) and [HVS video](https://www.youtube.com/watch?v=_UWR7hw3AD0) as related demonstrations. Video contents were not verified in this research pass; do not use these as evidence of an exact sensor/specification match.
- Irrigate Smart's site links [its MP4 video](https://irrigatesmart.futureaware.tech/assets/Irrigate%20Smart%20Video.mp4). Fetch failed in the coordinating research pass, so playback/content remains unverified.

## How to describe the contribution accurately

Avoid claiming that multisensor smart agriculture, automatic irrigation, or flame-triggered water suppression is unprecedented. A defensible framing is an **integrated implementation** combining soil chemistry, ambient monitoring, and a separate directed hazard-response subsystem, with demonstrated local operation and a unified dashboard. Whether those features are novel depends on the final implemented specification and wider literature review. Strong assessment evidence would include the actual wiring/BOM, firmware behavior during network loss, safe pump arbitration, calibration records, and repeatable tests of irrigation and suppression separately and together.
