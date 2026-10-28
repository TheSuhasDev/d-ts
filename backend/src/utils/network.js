import os from "os";

/**
 * Returns the primary physical IPv4 address of this machine (e.g., 192.168.1.6).
 * Filters out virtual adapters (VMware, VirtualBox, WSL, etc.) to ensure
 * mobile devices on the same Wi-Fi network can reach the server.
 */
export function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, ifaces] of Object.entries(interfaces)) {
    for (const iface of ifaces || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        const isVirtual = /vmware|virtual|vbox|wsl|hyper-v|vethernet/i.test(name);
        candidates.push({ name, address: iface.address, isVirtual });
      }
    }
  }

  // Prioritize physical adapters (Wi-Fi, Ethernet)
  const physical = candidates.find((c) => !c.isVirtual);
  return physical ? physical.address : candidates[0]?.address || "127.0.0.1";
}
