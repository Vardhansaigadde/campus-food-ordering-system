# Deploying Campus Food for free (Oracle Cloud Always Free)

Everything below costs ₹0. The result is one server running all 6 microservices and MySQL. Students and canteen staff reach it at `https://<name>.duckdns.org` from their phones.

## 1. Create the free server (about 20 min, done once)

1. Sign up at https://signup.cloud.oracle.com.
   - **Choose the home region carefully, because you can't change it later.** Pick **India South (Hyderabad)** or **India West (Mumbai)**.
   - The card is only for verification; Always Free resources are never charged. Stay on the free tier and don't click "Upgrade to Pay As You Go".
2. Go to **Compute → Instances → Create instance**.
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPU and 12 GB memory. That's half the free allowance and plenty for this project.
   - Download the SSH private key Oracle offers and keep it safe.
   - If you see "Out of capacity", choose another availability domain or try again later. Free ARM servers are popular.
3. Note the instance's **public IP address**.
4. Open the web ports in Oracle's firewall:
   - Go to **Networking → Virtual cloud networks → your VCN → Security Lists → Default**.
   - Add **Ingress rules** for source `0.0.0.0/0`, TCP, ports **80** and **443**.

## 2. Get a free web address (5 min)

1. Sign in at https://www.duckdns.org with Google or GitHub.
2. Create a subdomain, e.g. `campusfood`, and set its IP to the server's public IP.

The address is now `campusfood.duckdns.org`. Caddy gets the HTTPS certificate for it automatically.

## 3. Set up the server

Connect from your PC:

```bash
ssh -i path/to/oracle-key ubuntu@<PUBLIC-IP>
```

Then run these commands on the server:

```bash
# Oracle's Ubuntu image blocks ports 80/443 inside the VM too - open them
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Install Docker (official script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # log out and back in so the docker group applies
```

## 4. Put the code on the server and start it

Copy the project to `/home/ubuntu/campus-food`. You can `git clone` it from a private GitHub repository, which is free, or upload it with `scp`. Then:

```bash
cd ~/campus-food
cp .env.example .env
nano .env          # fill in EVERY value; make secrets with: openssl rand -base64 48
chmod 600 .env
docker compose up -d --build     # first build takes 10-15 minutes
docker compose ps                # all services should be "running"
```

Wait about 2 minutes for the services to register, then open `https://<your-domain>` on a phone.

To load the 3 demo canteens for a test, run this from your PC (Python 3). Edit `GATEWAY` and `ADMIN` in the script first:

```bash
python scripts/seed_demo.py
```

**For the real trial, don't use demo data.** Create the real canteens from the admin page instead.

## 5. Daily backup (5 min, do it before the trial starts)

Run these commands on the server:

```bash
mkdir -p ~/backups
crontab -e
```

Add this line, which backs up the 4 databases every night at 23:30 and keeps 14 days:

```
30 23 * * * cd ~/campus-food && docker compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --databases auth_db restaurant_db order_db notification_db' | gzip > ~/backups/cf-$(date +\%F).sql.gz && find ~/backups -name 'cf-*.sql.gz' -mtime +14 -delete
```

Also copy the backups off the server now and then, for example to Google Drive. If the server dies, the copies on it die too.

## Everyday commands

| Task | Command |
|---|---|
| See status | `docker compose ps` |
| See logs of one service | `docker compose logs -f --tail 100 order-service` |
| Deploy new code | `git pull && docker compose up -d --build` |
| Restart everything | `docker compose restart` |
| Restore a backup | `gunzip -c ~/backups/cf-DATE.sql.gz \| docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'` |

Services restart by themselves after a crash or a server reboot (`restart: unless-stopped`).

## Important

- **Oracle reclaims idle free servers.** An Always Free instance whose CPU stays below about 20% for 7 days can be stopped. Daily canteen use normally keeps it active, but check the instance during holidays.
- Only ports 80/443 (Caddy) are public. MySQL, Eureka and the services can't be reached from the internet.
