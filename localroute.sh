#/bin/sh
#
# Use iptables (on a Linux system) to route http and https packets to
# a local instance of offlineweb
#
# Usage: sudo ./localroute.sh [remove]
#
iptables -t nat -D OUTPUT -p tcp ! -s 172.20.0.100 --dport 80 -j DNAT --to-destination 172.20.0.100:3129 2>/dev/null
iptables -t nat -D OUTPUT -p tcp ! -s 172.20.0.100 --dport 443 -j DNAT --to-destination 172.20.0.100:3130 2>/dev/null
if [ "OPT $1" != "OPT remove" ]
then
  echo "Routing web requests local beluga/offlineweb instance"
  iptables -t nat -A OUTPUT -p tcp ! -s 172.20.0.100 --dport 80 -j DNAT --to-destination 172.20.0.100:3129
  iptables -t nat -A OUTPUT -p tcp ! -s 172.20.0.100 --dport 443 -j DNAT --to-destination 172.20.0.100:3130
else
  echo "Removing routing of web requests to local beluga/offlineweb instance"
fi
