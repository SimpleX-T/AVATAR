#include <ESP32Servo.h>

#include "config.h"
#include "pins.h"
#include "servo.h"
#include "timer.h"

namespace
{
Servo servoMotor;
int currentAngle = SERVO_CENTER;
unsigned long lastMoveAt = 0;
bool sweepingRight = true;

void writeAngle(int angle)
{
    currentAngle = constrain(angle, SERVO_LEFT, SERVO_RIGHT);
    servoMotor.write(currentAngle);
}
}

namespace fireServo
{
void begin()
{
    currentAngle = SERVO_LEFT;
}

void start()
{
    if (!ENABLE_SERVO_OUTPUT || servoMotor.attached()) return;
    servoMotor.setPeriodHertz(50);
    servoMotor.attach(FIRE_SERVO_PIN, 1000, 2000);
    sweepingRight = true;
    writeAngle(SERVO_LEFT);
}

void sweep(unsigned long now)
{
    if (!ENABLE_SERVO_OUTPUT || !elapsedSince(now, lastMoveAt, FIRE_SWEEP_STEP_INTERVAL))
        return;

    lastMoveAt = now;
    const int target = sweepingRight ? SERVO_RIGHT : SERVO_LEFT;
    const int delta = sweepingRight ? FIRE_SWEEP_STEP_DEGREES : -FIRE_SWEEP_STEP_DEGREES;
    writeAngle(currentAngle + delta);
    if (currentAngle == target)
        sweepingRight = !sweepingRight;
}

void center()
{
    if (servoMotor.attached()) servoMotor.detach();
    currentAngle = SERVO_LEFT;
}
}
