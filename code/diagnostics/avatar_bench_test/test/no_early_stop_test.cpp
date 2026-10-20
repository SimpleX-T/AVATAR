#include "../standalone_policy.h"

#include <cstdio>

int main() {
  const auto decision = irrigationStopDecision(true, true, true, 5000);
  if (decision != IrrigationStop::None) {
    std::fputs("FAIL: dry soil stops watering after only five seconds\n", stderr);
    return 1;
  }
  std::puts("PASS: no early irrigation stop");
}
