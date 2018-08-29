#/bin/sh
#
# Use iptables (on a Linux system) to route http and https packets to
# an instance of offlineweb
#
# Usage: sudo ./webroute.sh <ipaddress>
#   where <ipaddress> is the address of an offlineweb instance
#
echo "Routing web requests to $1"
iptables -t nat -F OUTPUT
iptables -t nat -A OUTPUT -p tcp --dport 80 -j DNAT --to-destination $1:80
iptables -t nat -A OUTPUT -p tcp --dport 443 -j DNAT --to-destination $1:443
