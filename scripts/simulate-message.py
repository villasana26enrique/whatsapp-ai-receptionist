#!/usr/bin/env python3
"""Sends a fake incoming WhatsApp message to the local n8n webhook, signed like Meta signs it, to test without a phone.

Usage: python scripts/simulate-message.py "Hi, do you take Cigna?" [--from 000] [--bad-signature]

The reply goes to the WhatsApp Cloud API, which rejects the fake number: read the agent's answer in the n8n
executions or in dental_clinic.chat_history. Standard library only.
"""
import argparse
import hashlib
import hmac
import json
import pathlib
import secrets
import time
import urllib.error
import urllib.request


def read_env(path):
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("text")
    parser.add_argument("--from", dest="sender", default="000", help="patient's number, digits only (fake by default)")
    parser.add_argument("--name", default="Test Patient", help="WhatsApp profile name")
    parser.add_argument("--bad-signature", action="store_true", help="sign with a wrong secret: expect 403")
    args = parser.parse_args()

    env = read_env(pathlib.Path(__file__).resolve().parent.parent / ".env")
    url = f"http://localhost:{env.get('N8N_HOST_PORT', '5678')}/webhook/whatsapp"
    event = {
        "object": "whatsapp_business_account",
        "entry": [{"id": "0", "changes": [{"field": "messages", "value": {
            "messaging_product": "whatsapp",
            "metadata": {"display_phone_number": "15550000000", "phone_number_id": "000000000000000"},
            "contacts": [{"profile": {"name": args.name}, "wa_id": args.sender}],
            "messages": [{"from": args.sender, "id": "wamid.TEST" + secrets.token_hex(12),
                          "timestamp": str(int(time.time())), "type": "text", "text": {"body": args.text}}],
        }}]}],
    }
    # Like Meta: compact JSON with non-ASCII escaped (á); the signature covers these exact bytes
    body = json.dumps(event, separators=(",", ":")).encode()
    secret = "wrong-secret" if args.bad_signature else env["META_APP_SECRET"]
    signature = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    request = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json", "X-Hub-Signature-256": signature})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(response.status)
    except urllib.error.HTTPError as error:
        print(error.code)


if __name__ == "__main__":
    main()
