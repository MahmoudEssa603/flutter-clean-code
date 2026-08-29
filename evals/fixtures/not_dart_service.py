# Eval fixture for 04-negative-trigger.json.
# The words "god class", "SOLID" and "rename" appear here on purpose: this file
# exists to confirm that flutter-clean-code does NOT activate on non-Dart code.


class OrderManager:
    """A god class that violates SOLID, in Python, on purpose."""

    def __init__(self, db, mailer, pdf):
        self.db = db
        self.mailer = mailer
        self.pdf = pdf

    def doIt(self, order_id, isDraft):
        o = self.db.fetch(order_id)
        if isDraft:
            return self.db.save_draft(o)
        t = 0
        for i in o["items"]:
            t += i["price"] * i["qty"]
        if o["user"]["premium"] and t > 100:
            t = t - (t * 0.1)
        self.mailer.send(o["user"]["email"], self.pdf.render(o))
        return t
