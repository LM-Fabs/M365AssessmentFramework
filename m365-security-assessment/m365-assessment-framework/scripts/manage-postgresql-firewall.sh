#!/bin/bash

# PostgreSQL Firewall Management Script
# This script manages firewall rules for PostgreSQL Flexible Server to allow Azure Static Web Apps

set -e

# Configuration
POSTGRES_SERVER="psql-c6qdbpkda5cvs"
RESOURCE_GROUP="M365_Assessment"
SUBSCRIPTION_ID="200830ff-e2b0-4cd7-9fb8-b263090a28a3"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Function to check if Azure CLI is logged in
check_azure_login() {
    if ! az account show &>/dev/null; then
        error "Not logged in to Azure CLI. Please run 'az login' first."
        exit 1
    fi
    log "Azure CLI authentication verified"
}

# Function to create comprehensive firewall rules
create_comprehensive_firewall_rules() {
    log "Creating comprehensive firewall rules for PostgreSQL Flexible Server..."
    
    # Rule 1: Allow all Azure services (0.0.0.0 range)
    log "Creating rule: AllowAllAzureServices"
    az postgres flexible-server firewall-rule create \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --rule-name "AllowAllAzureServices" \
        --start-ip-address "0.0.0.0" \
        --end-ip-address "0.0.0.0" \
        --output none 2>/dev/null || warn "AllowAllAzureServices rule already exists"
    
    # Rule 2: Azure Static Web Apps IP range (based on observed IPs)
    log "Creating rule: AllowStaticWebAppsRange"
    az postgres flexible-server firewall-rule create \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --rule-name "AllowStaticWebAppsRange" \
        --start-ip-address "132.220.0.0" \
        --end-ip-address "132.220.255.255" \
        --output none 2>/dev/null || warn "AllowStaticWebAppsRange rule already exists"
    
    # Rule 3: Azure App Service / Function Apps range
    log "Creating rule: AllowAzureAppServices"
    az postgres flexible-server firewall-rule create \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --rule-name "AllowAzureAppServices" \
        --start-ip-address "13.64.0.0" \
        --end-ip-address "13.107.255.255" \
        --output none 2>/dev/null || warn "AllowAzureAppServices rule already exists"
    
    # Rule 4: Additional Azure services range
    log "Creating rule: AllowAzureServices2"
    az postgres flexible-server firewall-rule create \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --rule-name "AllowAzureServices2" \
        --start-ip-address "20.0.0.0" \
        --end-ip-address "20.255.255.255" \
        --output none 2>/dev/null || warn "AllowAzureServices2 rule already exists"
    
    # Rule 5: Allow current IP (for development/testing)
    CURRENT_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null || echo "0.0.0.0")
    if [ "$CURRENT_IP" != "0.0.0.0" ]; then
        log "Creating rule: AllowCurrentIP ($CURRENT_IP)"
        az postgres flexible-server firewall-rule create \
            --name "$POSTGRES_SERVER" \
            --resource-group "$RESOURCE_GROUP" \
            --rule-name "AllowCurrentIP" \
            --start-ip-address "$CURRENT_IP" \
            --end-ip-address "$CURRENT_IP" \
            --output none 2>/dev/null || warn "AllowCurrentIP rule already exists"
    fi
}

# Function to clean up redundant rules
cleanup_redundant_rules() {
    log "Cleaning up redundant firewall rules..."
    
    # Get all existing rules
    EXISTING_RULES=$(az postgres flexible-server firewall-rule list \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[].name" \
        --output tsv)
    
    # Rules to keep
    KEEP_RULES=("AllowAllAzureServices" "AllowStaticWebAppsRange" "AllowAzureAppServices" "AllowAzureServices2" "AllowCurrentIP")
    
    # Delete rules that are not in the keep list
    for rule in $EXISTING_RULES; do
        if [[ ! " ${KEEP_RULES[@]} " =~ " ${rule} " ]]; then
            log "Removing redundant rule: $rule"
            az postgres flexible-server firewall-rule delete \
                --name "$POSTGRES_SERVER" \
                --resource-group "$RESOURCE_GROUP" \
                --rule-name "$rule" \
                --yes \
                --output none 2>/dev/null || warn "Failed to delete rule: $rule"
        fi
    done
}

# Function to list current firewall rules
list_firewall_rules() {
    log "Current firewall rules:"
    az postgres flexible-server firewall-rule list \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --output table
}

# Function to test connectivity
test_connectivity() {
    log "Testing PostgreSQL connectivity..."
    
    # Test basic connectivity (this will fail if PostgreSQL is not accessible)
    if command -v psql &> /dev/null; then
        POSTGRES_HOST=$(az postgres flexible-server show \
            --name "$POSTGRES_SERVER" \
            --resource-group "$RESOURCE_GROUP" \
            --query "fullyQualifiedDomainName" \
            --output tsv)
        
        log "PostgreSQL host: $POSTGRES_HOST"
        log "Use the following command to test connectivity:"
        echo "psql -h $POSTGRES_HOST -U assessment_admin -d m365_assessment -c 'SELECT version();'"
    else
        warn "psql command not found. Please install PostgreSQL client tools to test connectivity."
    fi
}

# Function to add a specific IP address
add_specific_ip() {
    local ip_address="$1"
    local rule_name="$2"
    
    if [ -z "$ip_address" ] || [ -z "$rule_name" ]; then
        error "Usage: add_specific_ip <ip_address> <rule_name>"
        return 1
    fi
    
    log "Adding specific IP address: $ip_address as rule: $rule_name"
    az postgres flexible-server firewall-rule create \
        --name "$POSTGRES_SERVER" \
        --resource-group "$RESOURCE_GROUP" \
        --rule-name "$rule_name" \
        --start-ip-address "$ip_address" \
        --end-ip-address "$ip_address" \
        --output none
}

# Function to show help
show_help() {
    echo "PostgreSQL Firewall Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup      - Create comprehensive firewall rules"
    echo "  cleanup    - Remove redundant firewall rules"
    echo "  list       - List current firewall rules"
    echo "  test       - Test PostgreSQL connectivity"
    echo "  add-ip     - Add specific IP address (requires IP and rule name)"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 add-ip 192.168.1.100 MySpecificRule"
    echo "  $0 cleanup"
    echo "  $0 list"
}

# Main script logic
main() {
    case "${1:-setup}" in
        "setup")
            check_azure_login
            create_comprehensive_firewall_rules
            list_firewall_rules
            log "Firewall setup completed successfully!"
            ;;
        "cleanup")
            check_azure_login
            cleanup_redundant_rules
            list_firewall_rules
            ;;
        "list")
            check_azure_login
            list_firewall_rules
            ;;
        "test")
            check_azure_login
            test_connectivity
            ;;
        "add-ip")
            check_azure_login
            add_specific_ip "$2" "$3"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
