#include <ESP32Servo.h>

#include "config.h"
#include "pins.h"
#include "servo.h"

namespace
{
Servo servoMotor;
}

namespace fireServo
{
void begin()
{
    servoMotor.setPeriodHertz(50);
    servoMotor.attach(FIRE_SERVO_PIN, 500, 2400);
    center();
}

void pointTo(FireDirection direction)
{
    switch (direction)
    {
    case FireDirection::Left:
        servoMotor.write(SERVO_LEFT);
        break;
    case FireDirection::Right:
        servoMotor.write(SERVO_RIGHT);
        break;
    default:
        servoMotor.write(SERVO_CENTER);
        break;
    }
}

void center()
{
    servoMotor.write(SERVO_CENTER);
}
}
