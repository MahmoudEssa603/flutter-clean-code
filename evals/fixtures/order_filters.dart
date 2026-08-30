class OrderFilters {
  OrderFilters(this.query, this.status, this.includeArchived);

  final String query;
  final String status;
  final bool includeArchived;

  List<Map<String, dynamic>> apply(
    List<Map<String, dynamic>> orders,
    bool sortDescending,
  ) {
    final result = <Map<String, dynamic>>[];
    for (final o in orders) {
      if (o['status'] != null) {
        if (status == '' || o['status'] == status) {
          if (includeArchived || o['archived'] != true) {
            final t = o['title']?.toString() ?? '';
            if (query == '' || t.toLowerCase().contains(query.toLowerCase())) {
              result.add(o);
            }
          }
        }
      }
    }

    if (sortDescending) {
      result.sort((a, b) => (b['total'] as num).compareTo(a['total'] as num));
    } else {
      result.sort((a, b) => (a['total'] as num).compareTo(b['total'] as num));
    }

    if (result.length > 250) {
      return result.sublist(0, 250);
    }
    return result;
  }

  String getLabel() {
    lastLabel = status == '' ? 'All orders' : status;
    return lastLabel;
  }

  String lastLabel = '';
}
