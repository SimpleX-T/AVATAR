#include "state.h"

SystemState systemState;

const char *fireDirectionName(FireDirection direction)
{
    switch (direction)
    {
    case FireDirection::Left:
        return "left";
    case FireDirection::Center:
        return "center";
    case FireDirection::Right:
        return "right";
    default:
        return "none";
    }
}
