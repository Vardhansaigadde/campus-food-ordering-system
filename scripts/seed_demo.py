"""
Loads demo data through the API Gateway (so it also exercises the microservices):
3 campus canteens with staff logins, full menus marked available today, and a demo student.

Run after all services are up:   python scripts/seed_demo.py
Safe to run again – existing restaurants/accounts are reused, menus are re-marked available for today.
"""
import json
import urllib.error
import urllib.request

GATEWAY = "http://localhost:8080"
ADMIN = {"email": "admin@campusfood.local", "password": "Admin@123"}  # from auth-service application.yml
STUDENT = {"name": "Demo Student", "email": "student@campusfood.test", "phone": "9876543210", "password": "student123"}

RESTAURANTS = [
    {
        "name": "Main Canteen", "code": "MC", "location": "Block A, Ground Floor", "openingHours": "7:30 AM – 9:00 PM",
        "description": "South Indian breakfast, full meals and biryani.",
        "login": ("maincanteen@campusfood.test", "canteen123"),
        "dishes": [
            ("Idli (2 pcs) with Sambar", 30, "Breakfast", True, None, False),
            ("Masala Dosa", 50, "Breakfast", True, None, True),
            ("Pongal", 40, "Breakfast", True, None, False),
            ("Veg Meals", 80, "Main Course", True, None, False),
            ("Veg Biryani", 90, "Rice & Biryani", True, 40, False),
            ("Chicken Biryani", 140, "Rice & Biryani", False, 30, True),
            ("Egg Fried Rice", 90, "Rice & Biryani", False, None, False),
            ("Filter Coffee", 20, "Beverages", True, None, False),
        ],
    },
    {
        "name": "Food Court", "code": "FC", "location": "Central Library Block", "openingHours": "10:00 AM – 8:00 PM",
        "description": "North Indian, Chinese and quick bites.",
        "login": ("foodcourt@campusfood.test", "canteen123"),
        "dishes": [
            ("Paneer Butter Masala with 2 Rotis", 110, "North Indian", True, None, True),
            ("Chole Bhature", 80, "North Indian", True, 25, False),
            ("Veg Noodles", 70, "Chinese", True, None, False),
            ("Chicken Manchurian", 120, "Chinese", False, None, False),
            ("Gobi 65", 60, "Snacks", True, None, False),
            ("Samosa (2 pcs)", 25, "Snacks", True, 60, False),
        ],
    },
    {
        "name": "Juice & Snacks Corner", "code": "JS", "location": "Near Sports Ground", "openingHours": "9:00 AM – 7:00 PM",
        "description": "Fresh juices, shakes and evening snacks.",
        "login": ("juicecorner@campusfood.test", "canteen123"),
        "dishes": [
            ("Fresh Lime Soda", 30, "Beverages", True, None, False),
            ("Mango Shake", 60, "Beverages", True, None, True),
            ("Cold Coffee", 50, "Beverages", True, None, False),
            ("Veg Puff", 20, "Snacks", True, 40, False),
            ("Egg Puff", 25, "Snacks", False, 30, False),
            ("Fruit Bowl", 45, "Desserts", True, None, False),
        ],
    },
]


def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(GATEWAY + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode()
            return r.status, json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            return e.code, json.loads(text)
        except ValueError:
            return e.code, text


def main():
    status, admin = call("POST", "/api/auth/ops/login", ADMIN)
    if status != 200:
        raise SystemExit(f"Admin login failed ({status}). Are all services running?")
    admin_token = admin["token"]

    _, existing = call("GET", "/api/admin/restaurants", token=admin_token)
    by_code = {r["code"]: r for r in existing}

    # Hide restaurants created by automated tests
    for r in existing:
        if r["name"].startswith("Test Canteen") and r["active"]:
            call("DELETE", f"/api/admin/restaurants/{r['id']}", token=admin_token)

    for spec in RESTAURANTS:
        email, password = spec["login"]
        if spec["code"] not in by_code:
            status, created = call("POST", "/api/admin/restaurants", {
                "name": spec["name"], "code": spec["code"], "location": spec["location"],
                "openingHours": spec["openingHours"], "description": spec["description"],
                "loginEmail": email, "loginPassword": password}, admin_token)
            print(f"  + restaurant {spec['name']} ({status})")
        status, staff = call("POST", "/api/auth/login", {"email": email, "password": password})
        if status != 200:
            print(f"  ! could not log in as {email}: {staff}")
            continue
        token = staff["token"]
        _, dishes = call("GET", "/api/restaurant/menu/dishes", token=token)
        have = {d["name"] for d in dishes}
        for name, price, category, veg, daily_stock, special in spec["dishes"]:
            if name not in have:
                call("POST", "/api/restaurant/menu/dishes", {
                    "name": name, "price": price, "category": category, "veg": veg,
                    "dailyStock": daily_stock, "special": special}, token)
        call("POST", "/api/restaurant/menu/all-availability", {"available": True}, token)
        call("PATCH", "/api/restaurant/status", {"status": "OPEN"}, token)
        print(f"  OK {spec['name']}: menu available today, status OPEN  (login {email} / {password})")

    status, _ = call("POST", "/api/auth/register", STUDENT)
    print(f"  OK demo student {STUDENT['email']} / {STUDENT['password']}" + (" (created)" if status == 201 else " (exists)"))


if __name__ == "__main__":
    main()
