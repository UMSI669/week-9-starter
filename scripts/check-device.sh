#!/bin/bash
# Reports whether a physical iOS device is visible, paired, and ready to build to.
echo "=== Physical devices Xcode can see ==="
xcrun devicectl list devices 2>/dev/null | grep -viE 'simulated' | head -10
echo
echo "=== USB bus (a connected iPad/iPhone must appear here) ==="
if system_profiler SPUSBDataType 2>/dev/null | grep -qiE 'iPad|iPhone'; then
  system_profiler SPUSBDataType 2>/dev/null | grep -iE 'iPad|iPhone' | head -5
else
  echo "  NOTHING. The device is not connected as a data device."
  echo "  -> Most likely a charge-only cable. Try the cable that came with the iPad."
  echo "  -> Also: unlock it and tap 'Trust This Computer'."
fi
echo
echo "=== Verdict ==="
if xcrun devicectl list devices 2>/dev/null | grep -v simulated | grep -qE 'connected|available'; then
  echo "  Device is connected. Select it in Xcode's destination dropdown and press Cmd-R."
else
  echo "  No usable physical device yet. Xcode's 'team has no devices' signing error is a"
  echo "  SYMPTOM of this, not a separate problem -- it clears once the device connects."
fi
