describe("Payment Calculations & State Transitions", () => {
  function processPayment({
    totalAmount,
    advancePercentage = 30,
    currentPaid = 0,
    paymentAmount,
  }) {
    const advanceRequired = Math.round((totalAmount * advancePercentage) / 100);
    const balanceBefore = Math.max(0, totalAmount - currentPaid);

    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    if (paymentAmount > balanceBefore) {
      throw new Error(
        `Payment amount (₹${paymentAmount}) exceeds outstanding balance (₹${balanceBefore})`
      );
    }

    const newTotalPaid = currentPaid + paymentAmount;
    const newBalance = Math.max(0, totalAmount - newTotalPaid);

    let paymentStatus = "ADVANCE_PENDING";
    if (newTotalPaid >= totalAmount) {
      paymentStatus = "PAID";
    } else if (newTotalPaid >= advanceRequired) {
      paymentStatus = "ADVANCE_RECEIVED";
    }

    return {
      advanceRequired,
      balanceBefore,
      newTotalPaid,
      newBalance,
      paymentStatus,
    };
  }

  test("calculates advance required accurately", () => {
    const res = processPayment({
      totalAmount: 15000,
      advancePercentage: 30,
      currentPaid: 0,
      paymentAmount: 4500,
    });
    expect(res.advanceRequired).toBe(4500);
    expect(res.newTotalPaid).toBe(4500);
    expect(res.newBalance).toBe(10500);
    expect(res.paymentStatus).toBe("ADVANCE_RECEIVED");
  });

  test("rejects overpayments exceeding outstanding balance", () => {
    expect(() =>
      processPayment({
        totalAmount: 10000,
        advancePercentage: 30,
        currentPaid: 8000,
        paymentAmount: 3000, // Balance is only 2000
      })
    ).toThrow(/exceeds outstanding balance/);
  });

  test("rejects zero or negative payments", () => {
    expect(() =>
      processPayment({
        totalAmount: 10000,
        currentPaid: 0,
        paymentAmount: 0,
      })
    ).toThrow(/greater than zero/);

    expect(() =>
      processPayment({
        totalAmount: 10000,
        currentPaid: 0,
        paymentAmount: -500,
      })
    ).toThrow(/greater than zero/);
  });

  test("transitions to PAID when exact balance is settled", () => {
    const res = processPayment({
      totalAmount: 12000,
      advancePercentage: 30,
      currentPaid: 3600,
      paymentAmount: 8400,
    });
    expect(res.newTotalPaid).toBe(12000);
    expect(res.newBalance).toBe(0);
    expect(res.paymentStatus).toBe("PAID");
  });

  test("remains ADVANCE_PENDING if partial payment is below advanceRequired", () => {
    const res = processPayment({
      totalAmount: 10000,
      advancePercentage: 30, // advance required = 3000
      currentPaid: 0,
      paymentAmount: 1500,
    });
    expect(res.advanceRequired).toBe(3000);
    expect(res.newTotalPaid).toBe(1500);
    expect(res.newBalance).toBe(8500);
    expect(res.paymentStatus).toBe("ADVANCE_PENDING");
  });
});
