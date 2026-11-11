#!/bin/bash
# Poll for ~40s. Plug the iPad in (and unlock it) while this runs.
echo "Watching for a physical iOS device. Plug in the iPad now, and unlock it."
echo "Press Ctrl-C to stop."
echo
for i in $(seq 1 20); do
  usb=$(system_profiler SPUSBDataType 2>/dev/null | grep -icE 'iPad|iPhone')
  dev=$(xcrun devicectl list devices 2>/dev/null | grep -v simulated | grep -cE 'connected|available|paired')
  printf "  [%02d] USB devices: %s | Xcode-visible: %s" "$i" "$usb" "$dev"
  if [ "$usb" -gt 0 ]; then
    echo "  <- DETECTED on USB"
    echo
    echo "The Mac can see it. If Xcode still says unavailable:"
    echo "  - unlock the iPad and tap 'Trust This Computer'"
    echo "  - Xcode > Window > Devices and Simulators, wait for 'Preparing device'"
    exit 0
  fi
  echo ""
  sleep 2
done
echo
echo "Nothing appeared on USB in 40 seconds."
echo "The cable is almost certainly charge-only, or the port is not working."
echo "Decisive test: does the iPad show a charging indicator with this cable?"
echo "  charges but never appears here  -> charge-only cable, swap it"
echo "  does not charge either          -> cable or port is dead"
