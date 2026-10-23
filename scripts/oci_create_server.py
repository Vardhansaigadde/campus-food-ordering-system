"""
Keeps asking Oracle Cloud for an Always Free ARM server until one is free, then stops.

Oracle's free Ampere (ARM) servers are often "Out of capacity". Instead of clicking
Create by hand, this tries every few minutes, day and night, and stops on success.

Needs:  pip install oci
        ~/.oci/config  (API key - see docs/DEPLOY-ORACLE.md)
Run:    python scripts/oci_create_server.py   (or double-click scripts/oci-create-server.bat)

It only ever creates ONE server, and only inside the Always Free limits (1 OCPU / 6 GB here).
Safe to stop (Ctrl+C) and start again at any time.
"""
import os
import random
import subprocess
import sys
import time
from datetime import datetime

import oci

NAME = "campus-food-server"
VCN_NAME = "campus-food-vcn"
SUBNET_NAME = "public subnet-campus-food-vcn"
SHAPE = "VM.Standard.A1.Flex"
OCPUS, MEMORY_GB = 1, 6            # Always Free allows up to 4 / 24 in total - enlarge later
SSH_PUBLIC_KEY = os.path.expanduser(r"~\OneDrive\Desktop\oracle-keys\ssh-key-2026-10-12.key.pub")
WAIT_SECONDS = 2 * 60              # between tries; Oracle answers "Too many requests" if much faster
WAIT_AFTER_LIMIT = 15 * 60         # after Oracle says "Too many requests"


def log(msg):
    line = f"[{datetime.now():%d %b %H:%M:%S}] {msg}"
    print(line, flush=True)
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "oci_create_server.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def notify(title, text):
    """Windows pop-up so you notice even if the window is minimised."""
    if os.name == "nt":
        subprocess.run(["msg", "*", f"{title}: {text}"], check=False)


def find(items, name, what):
    for i in items:
        if i.display_name == name:
            return i
    sys.exit(f"Could not find {what} '{name}'. Check the name in the Oracle console.")


def main():
    cfg = oci.config.from_file()
    tenancy = cfg["tenancy"]
    identity = oci.identity.IdentityClient(cfg)
    network = oci.core.VirtualNetworkClient(cfg)
    compute = oci.core.ComputeClient(cfg)

    ad = identity.list_availability_domains(tenancy).data[0].name
    vcn = find(network.list_vcns(tenancy).data, VCN_NAME, "network")
    subnet = find(network.list_subnets(tenancy, vcn_id=vcn.id).data, SUBNET_NAME, "subnet")
    image = compute.list_images(tenancy, operating_system="Canonical Ubuntu", operating_system_version="24.04",
                                shape=SHAPE, sort_by="TIMECREATED", sort_order="DESC").data[0]
    with open(SSH_PUBLIC_KEY, encoding="utf-8") as f:
        ssh_key = f.read().strip()

    details = oci.core.models.LaunchInstanceDetails(
        compartment_id=tenancy,
        availability_domain=ad,
        display_name=NAME,
        shape=SHAPE,
        shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=OCPUS, memory_in_gbs=MEMORY_GB),
        source_details=oci.core.models.InstanceSourceViaImageDetails(image_id=image.id),
        create_vnic_details=oci.core.models.CreateVnicDetails(
            subnet_id=subnet.id, assign_public_ip=True, display_name=f"{NAME}-vnic"),
        metadata={"ssh_authorized_keys": ssh_key},
    )
    log(f"Trying to get {SHAPE} ({OCPUS} OCPU / {MEMORY_GB} GB) in {ad} with {image.display_name}")

    attempt = 0
    while True:
        attempt += 1
        try:
            # Never create a second one (e.g. if you got it in the console meanwhile)
            existing = [i for i in compute.list_instances(tenancy, display_name=NAME).data
                        if i.lifecycle_state not in ("TERMINATED", "TERMINATING")]
            if existing:
                return done(compute, network, tenancy, existing[0])
            instance = compute.launch_instance(details).data
            log(f"Attempt {attempt}: SUCCESS - server is being created!")
            return done(compute, network, tenancy, instance)
        except oci.exceptions.ServiceError as e:
            if e.status == 429:
                wait = WAIT_AFTER_LIMIT
                log(f"Attempt {attempt}: Oracle says too many requests - waiting {wait // 60} min")
            elif "capacity" in str(e.message).lower():
                wait = WAIT_SECONDS
                log(f"Attempt {attempt}: out of capacity - trying again in {wait // 60} min")
            elif e.status >= 500:
                wait = WAIT_SECONDS
                log(f"Attempt {attempt}: Oracle had a temporary problem ({e.status}) - trying again in {wait // 60} min")
            else:
                log(f"Attempt {attempt}: STOPPED - unexpected answer from Oracle: {e.status} {e.message}")
                notify("Campus Food server", f"Stopped: {e.message}")
                sys.exit(1)
        except Exception as e:  # no internet for a moment, laptop woke from sleep, etc.
            wait = WAIT_SECONDS
            log(f"Attempt {attempt}: network problem ({e.__class__.__name__}: {str(e)[:80]}) - trying again in {wait // 60} min")
        time.sleep(wait + random.randint(0, 30))


def done(compute, network, tenancy, instance):
    log("Waiting for the server to be RUNNING...")
    instance = oci.wait_until(compute, compute.get_instance(instance.id), "lifecycle_state", "RUNNING",
                              max_wait_seconds=900).data
    ip = None
    for att in compute.list_vnic_attachments(tenancy, instance_id=instance.id).data:
        ip = network.get_vnic(att.vnic_id).data.public_ip or ip
    log(f"DONE! {instance.display_name} is RUNNING. Public IP: {ip}")
    notify("Campus Food server is ready", f"Public IP: {ip}")


if __name__ == "__main__":
    main()
