import { describe, expect, test } from "vitest";

import { addressKey } from "./address";

describe("the key a limit keeps an address by", () => {
  test("[server:anonymous-limit-by-address] given an IPv4 address, when it is keyed, then it is the address whole, and its neighbour is another key", () => {
    expect(addressKey("198.51.100.7")).toBe("198.51.100.7");
    expect(addressKey("198.51.100.8")).not.toBe(addressKey("198.51.100.7"));
  });

  test("[server:anonymous-limit-by-address] given two IPv6 addresses in one /64, when each is keyed, then they share one key however they are written", () => {
    const key = addressKey("2001:db8:1:2::1");
    expect(key).toBe("2001:db8:1:2::/64");
    expect(addressKey("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe(key);
    expect(addressKey("2001:0DB8:0001:0002:abcd::9")).toBe(key);
    expect(addressKey("2001:DB8:1:2:0:0:0:0")).toBe(key);
    expect(addressKey("2001:db8:1:2::")).toBe(key);
    expect(addressKey("2001:db8:1:2:a:b:1.2.3.4")).toBe(key);
  });

  test("[server:anonymous-limit-by-address] given two IPv6 addresses in different /64s, when each is keyed, then the keys differ, also where the /64s differ only in their fourth group or after a compression", () => {
    expect(addressKey("2001:db8:1:3::1")).not.toBe(addressKey("2001:db8:1:2::1"));
    expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(addressKey("2001:db8::1:0:0:1")).toBe("2001:db8:0:0::/64");
    expect(addressKey("2001:db8::2:1:0:0:1")).toBe("2001:db8:0:2::/64");
    expect(addressKey("1:2::3:4:5:1.2.3.4")).toBe("1:2:0:3::/64");
    expect(addressKey("::1")).toBe("0:0:0:0::/64");
  });

  test("[server:anonymous-limit-by-address] given an IPv4 address carried in IPv6, when it is keyed, then it is the IPv4 address whole, in any of its written forms", () => {
    expect(addressKey("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(addressKey("::FFFF:198.51.100.7")).toBe("198.51.100.7");
    expect(addressKey("0:0:0:0:0:ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(addressKey("::ffff:c633:6407")).toBe("198.51.100.7");
    expect(addressKey("::ffff:198.51.100.8")).not.toBe(addressKey("::ffff:198.51.100.7"));
  });

  test("[server:anonymous-limit-by-address] given a value that is no address, when it is keyed, then it is kept as it came, so it never shares a key with a real one by accident", () => {
    expect(addressKey("not an address")).toBe("not an address");
    expect(addressKey("1:2:3")).toBe("1:2:3");
    expect(addressKey("1::2::3")).toBe("1::2::3");
  });
});
