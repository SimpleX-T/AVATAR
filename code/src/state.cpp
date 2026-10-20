#include "state.h"

#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

SystemState systemState;

namespace
{
SemaphoreHandle_t stateMutex = nullptr;
}

bool initializeSystemStateLock()
{
    stateMutex = xSemaphoreCreateMutex();
    return stateMutex != nullptr;
}

void lockSystemState()
{
    xSemaphoreTake(stateMutex, portMAX_DELAY);
}

void unlockSystemState()
{
    xSemaphoreGive(stateMutex);
}
