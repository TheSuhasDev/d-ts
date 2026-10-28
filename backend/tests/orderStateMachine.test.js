describe("Order State Machine & Lifecycle Transitions", () => {
  const VALID_TRANSITIONS = {
    PROCESSING: ["ADVANCE_RECEIVED", "CANCELLED"],
    ADVANCE_RECEIVED: ["PACKED", "CANCELLED"],
    PACKED: ["DISPATCHED", "CANCELLED"],
    DISPATCHED: ["RETURNED"],
    CANCELLED: [],
    RETURNED: [],
  };

  function transitionOrderStatus(order, nextStatus, { user, note, cancellationType } = {}) {
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Invalid order status transition from ${order.status} to ${nextStatus}`
      );
    }

    const previousStatus = order.status;
    order.status = nextStatus;

    if (!order.timeline) order.timeline = [];
    order.timeline.push({
      status: nextStatus,
      updatedBy: user?.name || "System",
      note: note || `Status transitioned from ${previousStatus} to ${nextStatus}`,
      timestamp: new Date(),
    });

    if (nextStatus === "CANCELLED") {
      order.cancellationType = cancellationType || "RESTOCK";
      order.cancellationNote = note || "Order cancelled";
    }

    return order;
  }

  test("allows sequential order progression from PROCESSING to DISPATCHED", () => {
    let order = {
      orderNumber: "ORD/26-27/0001",
      status: "PROCESSING",
      timeline: [],
    };

    order = transitionOrderStatus(order, "ADVANCE_RECEIVED", { user: { name: "Finance Admin" } });
    expect(order.status).toBe("ADVANCE_RECEIVED");
    expect(order.timeline).toHaveLength(1);

    order = transitionOrderStatus(order, "PACKED", { user: { name: "Warehouse Staff" } });
    expect(order.status).toBe("PACKED");
    expect(order.timeline).toHaveLength(2);

    order = transitionOrderStatus(order, "DISPATCHED", { user: { name: "Logistics Admin" } });
    expect(order.status).toBe("DISPATCHED");
    expect(order.timeline).toHaveLength(3);
    expect(order.timeline[2].updatedBy).toBe("Logistics Admin");
  });

  test("rejects invalid status jumps such as PROCESSING directly to DISPATCHED", () => {
    const order = {
      orderNumber: "ORD/26-27/0002",
      status: "PROCESSING",
      timeline: [],
    };

    expect(() => transitionOrderStatus(order, "DISPATCHED")).toThrow(
      /Invalid order status transition from PROCESSING to DISPATCHED/
    );
  });

  test("rejects reverting a DISPATCHED order back to PROCESSING", () => {
    const order = {
      orderNumber: "ORD/26-27/0003",
      status: "DISPATCHED",
      timeline: [],
    };

    expect(() => transitionOrderStatus(order, "PROCESSING")).toThrow(
      /Invalid order status transition from DISPATCHED to PROCESSING/
    );
  });

  test("allows cancelling an order before dispatch with restock or scrap directive", () => {
    const order = {
      orderNumber: "ORD/26-27/0004",
      status: "PACKED",
      timeline: [],
    };

    const cancelledOrder = transitionOrderStatus(order, "CANCELLED", {
      user: { name: "Store Admin" },
      cancellationType: "RESTOCK",
      note: "Customer requested cancellation prior to vehicle loading",
    });

    expect(cancelledOrder.status).toBe("CANCELLED");
    expect(cancelledOrder.cancellationType).toBe("RESTOCK");
    expect(cancelledOrder.cancellationNote).toContain("prior to vehicle loading");
  });

  test("allows marking a DISPATCHED order as RETURNED", () => {
    const order = {
      orderNumber: "ORD/26-27/0005",
      status: "DISPATCHED",
      timeline: [],
    };

    const returnedOrder = transitionOrderStatus(order, "RETURNED", {
      user: { name: "Quality Inspector" },
      note: "Customer rejected 1 damaged tool",
    });

    expect(returnedOrder.status).toBe("RETURNED");
    expect(returnedOrder.timeline).toHaveLength(1);
    expect(returnedOrder.timeline[0].status).toBe("RETURNED");
  });
});
