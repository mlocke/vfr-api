#!/bin/bash
# Wrapper script for EODHD nightly build (for cron)

cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api
/usr/bin/python3 -u build-eodhd-nightly.py
