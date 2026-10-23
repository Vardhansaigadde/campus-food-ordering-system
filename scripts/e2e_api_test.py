"""End-to-end test of the Campus Food microservices, entirely through the API Gateway (port 8080)."""
import json, time, uuid, urllib.request, urllib.error, threading

GW = "http://localhost:8080"
results = []


def call(method, path, body=None, token=None, headers=None, base=GW, raw=False):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            txt = r.read().decode("utf-8")
            return r.status, (txt if raw else (json.loads(txt) if txt else None))
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8")
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))


for _ in range(40):
    s, _b = call("POST", "/api/auth/login", {"email": "x@y.z", "password": "nopenope"})
    if s == 401:
        break
    time.sleep(3)

suffix = uuid.uuid4().hex[:6]
code = "T" + "".join(c for c in suffix.upper() if c.isalpha())[:2].ljust(2, "X")

# ---------------- admin
s, a = call("POST", "/api/auth/ops/login", {"email": "admin@campusfood.local", "password": "Admin@123"})
check("admin hidden login works", s == 200 and a["user"]["role"] == "ADMIN", (s, a))
admin = a["token"]
s, b = call("POST", "/api/auth/login", {"email": "admin@campusfood.local", "password": "Admin@123"})
check("admin cannot use the normal login", s == 401, (s, b))
s, b = call("POST", "/api/auth/ops/login", {"email": "admin@campusfood.local", "password": "wrong"})
check("wrong admin login looks like 404", s == 404, (s, b))

staff_email = f"staff_{suffix}@campus.test"
s, r = call("POST", "/api/admin/restaurants", {
    "name": f"Test Canteen {suffix}", "code": code, "location": "Block A", "description": "Test",
    "openingHours": "8 AM - 8 PM", "loginEmail": staff_email, "loginPassword": "staff123"}, admin)
check("admin creates restaurant + staff login (Feign -> auth)", s == 201, (s, r))
rid = r["id"]

# ---------------- restaurant staff
s, st = call("POST", "/api/auth/login", {"email": staff_email, "password": "staff123"})
check("staff login", s == 200 and st["user"]["role"] == "RESTAURANT" and st["user"]["restaurantId"] == rid, (s, st))
staff = st["token"]
s, d1 = call("POST", "/api/restaurant/menu/dishes", {"name": "Veg Biryani", "price": 80, "category": "Rice & Biryani", "veg": True, "special": True}, staff)
s2, d2 = call("POST", "/api/restaurant/menu/dishes", {"name": "Chicken 65", "price": 120, "category": "Snacks", "veg": False, "dailyStock": 2}, staff)
s3, d3 = call("POST", "/api/restaurant/menu/dishes", {"name": "Hidden Dosa", "price": 40, "category": "South Indian", "veg": True}, staff)
check("staff adds 3 dishes", s == s2 == s3 == 201, (s, s2, s3, d1))
for d in (d1, d2):
    call("PATCH", f"/api/restaurant/menu/dishes/{d['id']}/availability", {"available": True}, staff)
s, prof = call("PATCH", "/api/restaurant/status", {"status": "OPEN"}, staff)
check("restaurant opens", s == 200 and prof["status"] == "OPEN", (s, prof))

# ---------------- student
s, su = call("POST", "/api/auth/register", {"name": "Ravi Kumar", "email": f"ravi_{suffix}@gmail.com", "phone": "9876543210", "password": "ravi123"})
check("anyone can register (student)", s == 201 and su["user"]["role"] == "STUDENT", (s, su))
student = su["token"]
s, lst = call("GET", "/api/restaurants", token=student)
check("student sees restaurant list", s == 200 and any(x["id"] == rid for x in lst), (s, lst))
s, menu = call("GET", f"/api/restaurants/{rid}", token=student)
names = [x["name"] for x in menu["dishes"]]
check("student sees ONLY available dishes", "Veg Biryani" in names and "Chicken 65" in names and "Hidden Dosa" not in names, names)
c65 = next(x for x in menu["dishes"] if x["name"] == "Chicken 65")
check("low stock badge value sent (Only 2 left)", c65["stockLeft"] == 2, c65)

s, b = call("GET", "/api/restaurant/orders/active", token=student)
check("student blocked from restaurant API (403)", s == 403, (s, b))
s, b = call("GET", "/api/admin/users", token=student)
check("student gets 404 for admin API (admin hidden)", s == 404, (s, b))
s, b = call("GET", "/api/admin/users")
check("no token on admin API -> 404", s == 404, (s, b))
s, b = call("GET", "/api/orders/my", base="http://localhost:8083")
check("direct call to Order Service port rejected (must use gateway)", s == 401, (s, b))
s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}]}, staff)
check("restaurant staff cannot place orders", s == 403, (s, b))

s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 8}]}, student)
check("max 7 of one dish enforced", s == 400, (s, b))
s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d3["id"], "quantity": 1}]}, student)
check("cannot order an unavailable dish", s == 409, (s, b))

key = str(uuid.uuid4())
s, o = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 2}, {"dishId": d2["id"], "quantity": 1}], "note": "less spicy", "price": 1}, student, {"Idempotency-Key": key})
check("order placed", s == 201, (s, o))
check("token format CODE-NNN", o["token"].startswith(code + "-"), o.get("token"))
check("4-digit OTP + QR given to student", len(o["otp"]) == 4 and o["qrCode"].startswith("CFPS:"), o)
check("server-side price (2x80 + 120 = 200)", float(o["total"]) == 200.0, o["total"])
check("queue position + ETA", o["queuePosition"] == 1 and o["etaMinutes"] >= 1, (o["queuePosition"], o["etaMinutes"]))
s, o2 = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 2}, {"dishId": d2["id"], "quantity": 1}]}, student, {"Idempotency-Key": key})
check("same Idempotency-Key returns same order (no duplicate)", o2["id"] == o["id"], (o2.get("id"), o["id"]))

s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d2["id"], "quantity": 2}]}, student)
check("stock check: only 1 left -> 409", s == 409, (s, b))

s, act = call("GET", "/api/restaurant/orders/active", token=staff)
mine = next(x for x in act if x["id"] == o["id"])
check("staff board shows order WITHOUT OTP", mine["otp"] is None and mine["qrCode"] is None, mine)

events = []
def listen():
    try:
        req = urllib.request.Request(GW + "/api/notifications/stream?token=" + student)
        with urllib.request.urlopen(req, timeout=25) as r:
            for line in r:
                line = line.decode().strip()
                if line.startswith("data:"):
                    events.append(line[5:])
                    if "ORDER_READY" in line:
                        return
    except Exception as e:
        events.append("ERR " + str(e))
t = threading.Thread(target=listen, daemon=True); t.start(); time.sleep(2)

s, b = call("POST", f"/api/restaurant/orders/{o['id']}/accept", token=staff)
check("staff accepts -> PREPARING", s == 200 and b["status"] == "PREPARING", (s, b))
s, b = call("POST", f"/api/orders/{o['id']}/cancel", token=student)
check("student cannot cancel once preparing", s == 409, (s, b))
s, b = call("POST", f"/api/restaurant/orders/{o['id']}/ready", token=staff)
check("staff marks READY", s == 200 and b["status"] == "READY", (s, b))
t.join(8)
check("live SSE event ORDER_READY reached the student", any("ORDER_READY" in e for e in events), events[-3:])

wrong = "0000" if o["otp"] != "0000" else "1111"
s, b = call("POST", "/api/restaurant/orders/verify", {"token": o["token"], "otp": wrong}, staff)
check("wrong OTP rejected with attempts left", s == 400 and "attempts left" in b["message"], (s, b))
s, b = call("POST", "/api/restaurant/orders/verify", {"token": o["token"], "otp": o["otp"]}, staff)
check("correct Order ID + OTP -> COLLECTED", s == 200 and b["status"] == "COLLECTED", (s, b))
s, b = call("POST", "/api/restaurant/orders/verify", {"token": o["token"], "otp": o["otp"]}, staff)
check("second verify says already collected", s == 409, (s, b))

s, o3 = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}], "pickupTime": None}, student)
call("POST", f"/api/restaurant/orders/{o3['id']}/ready", token=staff)
s, b = call("POST", "/api/restaurant/orders/verify-qr", {"code": o3["qrCode"]}, staff)
check("QR code verification works", s == 200 and b["status"] == "COLLECTED", (s, b))

s, b = call("POST", f"/api/orders/{o['id']}/rate", {"rating": 5, "review": "Tasty!", "dishes": [{"dishId": d1["id"], "stars": 4}]}, student)
check("student rates collected order", s == 200 and b["rating"] == 5, (s, b))
time.sleep(1)
s, menu = call("GET", f"/api/restaurants/{rid}", token=student)
vb = next(x for x in menu["dishes"] if x["name"] == "Veg Biryani")
check("dish rating updated in Restaurant Service", vb["rating"] == 4.0 and vb["bestseller"], vb)

s, o4 = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}]}, student)
s, b = call("POST", f"/api/restaurant/orders/{o4['id']}/reject", {"reason": "Item finished"}, staff)
check("staff rejects with reason", s == 200 and b["status"] == "REJECTED", (s, b))

ids = []
for i in range(3):
    s, x = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}]}, student)
    ids.append((s, x.get("id") if isinstance(x, dict) else None))
s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}]}, student)
check("4th active order blocked (max 3)", s == 409 and "3 active" in b["message"], (s, b, ids))
s, b = call("POST", f"/api/orders/{ids[0][1]}/cancel", token=student)
check("student cancels a PLACED order", s == 200 and b["status"] == "CANCELLED", (s, b))

s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}], "pickupTime": "2020-01-01T12:00:00"}, student)
check("pre-order in the past rejected", s == 400, (s, b))

call("PATCH", "/api/restaurant/status", {"status": "BUSY", "busyMinutes": 10}, staff)
call("POST", f"/api/orders/{ids[1][1]}/cancel", token=student)
s, b = call("POST", "/api/orders", {"restaurantId": rid, "items": [{"dishId": d1["id"], "quantity": 1}]}, student)
check("BUSY restaurant refuses new orders", s == 409 and "busy" in b["message"].lower(), (s, b))
call("PATCH", "/api/restaurant/status", {"status": "OPEN"}, staff)

s, b = call("GET", "/api/restaurant/orders/summary", token=staff)
check("restaurant day summary (expected cash = 280)", s == 200 and float(b["expectedCash"]) == 280.0, (s, b))
s, b = call("GET", "/api/orders/my/summary", token=student)
check("student monthly spending", s == 200 and b["orders"] == 2, (s, b))
s, b = call("GET", "/api/admin/orders/stats", token=admin)
check("admin stats", s == 200 and b["totalOrders"] >= 1, (s, b))
s, csv = call("GET", "/api/admin/orders/export", token=admin, raw=True)
check("admin CSV export", s == 200 and "Order ID,Token" in csv, (s, str(csv)[:80]))
s, b = call("POST", "/api/admin/announcements", {"message": "Test announcement", "level": "INFO"}, admin)
s2, act = call("GET", "/api/announcements/active")
check("announcement posted & public", s == 201 and any(x["message"] == "Test announcement" for x in act), (s, act))
call("DELETE", f"/api/admin/announcements/{b['id']}", token=admin)
time.sleep(1)
s, b = call("GET", "/api/admin/audit", token=admin)
check("audit log records actions from several services", s == 200 and len({x["action"] for x in b["content"]}) >= 3, (s, [x["action"] for x in b["content"]][:10]))
s, u = call("GET", "/api/admin/users?role=STUDENT", token=admin)
check("admin lists users", s == 200 and u["totalElements"] >= 1, (s, u))

print()
passed = sum(1 for _, ok in results if ok)
print(f"{passed}/{len(results)} checks passed")
