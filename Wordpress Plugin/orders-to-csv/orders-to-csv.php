<?php
/*
Plugin Name: Export Orders to CSV
Description: Export orders to CSV every hour and manually.
Version: 1.0
Author: Lewis Whitaker
*/

// Schedule the order export event
function schedule_order_export() {
    if (!wp_next_scheduled('export_orders_csv_event')) {
        wp_schedule_event(time(), 'hourly', 'export_orders_csv_event');
    }
}
add_action('wp', 'schedule_order_export');

// Hook for the scheduled event
add_action('export_orders_csv_event', 'export_orders_to_csv');

// Function to export orders to CSV
function export_orders_to_csv() {
    global $wpdb;

    // CSV file path with a fixed filename
    $csv_file = plugin_dir_path(__FILE__) . 'orders_export.csv';

    // CSV headers
    $csv_headers = array('orderNumber', 'used');

    // Fetch orders
    $orders = wc_get_orders(array(
        'limit'   => -1,
        'orderby' => 'date',
        'order'   => 'ASC',
    ));

    // Prepare CSV content
    $csv_content = implode(',', $csv_headers) . "\n";

    foreach ($orders as $order) {
        $order_number = $order->get_order_number();
        // You can customize the data retrieved and processed here as needed
        $csv_content .= "$order_number,\n";
    }

    // Write to CSV file
    file_put_contents($csv_file, $csv_content);

    // Provide a download link
    echo '<p>Download your <a href="' . plugin_dir_url(__FILE__) . 'orders_export.csv">CSV file</a></p>';
}

// Add a custom menu item for the plugin
function add_export_orders_menu() {
    add_menu_page(
        'Export Orders',
        'Export Orders',
        'manage_options',
        'export-orders-csv',
        'export_orders_page'
    );
}

add_action('admin_menu', 'add_export_orders_menu');

// Callback function for the plugin's menu page
function export_orders_page() {
    if (isset($_POST['export_orders_button'])) {
        export_orders_to_csv();
    }
    ?>
    <div class="wrap">
        <h2>Export Orders to CSV</h2>
        <form method="post" action="">
            <p>Click the button below to manually export orders to CSV:</p>
            <input type="submit" class="button" name="export_orders_button" value="Export Now">
        </form>
    </div>
    <?php
}
