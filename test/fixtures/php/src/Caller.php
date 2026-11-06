<?php

namespace App;

use Acme\Util\FloatComparator;
use function Acme\Util\helper;

class Caller
{
    public function run(FloatComparator $instance, Comparable $comparable)
    {
        FloatComparator::lessThanOrEquals(1.0, 2.0);
        FloatComparator::EPSILON;
        $instance->tolerance;
        helper();
        (new Child())->baseMethod();
        $comparable->compare();
        $local = 1;
        echo $local;

        return;
    }
}
