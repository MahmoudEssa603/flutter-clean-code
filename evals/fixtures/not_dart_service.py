class OrderManager:
    """A god class: persistence, mail and PDF rendering behind one door."""

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
